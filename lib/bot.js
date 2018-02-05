const { WebClient } = require('@slack/client');
const axios = require('axios');
const mysqlutil = require('./mysqlutil');

const slackClientOptions = {};
if (process.env.SLACK_ENV) {
  slackClientOptions.slackAPIUrl = process.env.SLACK_ENV;
}

const bot = {
  web: new WebClient(process.env.SLACK_BOT_TOKEN, slackClientOptions),
  approver_user_id: '',
  announcements: {},

  getAuthorizedUser() {
    axios.get('https://slack.com/api/auth.test', {
      params: {
        token: process.env.SLACK_CLIENT_TOKEN,
      },
    }).then((res) => {
      this.approver_user_id = res.data.user_id;
      // this.introduceToAdmin(); // Can get noisy on Glitch
    });
  },

  introduceToAdmin() {
    this.web.im.open(this.approver_user_id)
      .then(res => this.web.chat.postMessage(res.channel.id, `:wave: Hello! I'm here to help your team make approved announcements into the ${process.env.SLACK_ANNOUNCEMENT_CHANNEL} channel.\n Since you installed me, I will send any suggested announcements from the team for you to approve.`))
      .catch(console.error);
  },

  handleDirectMessage(userId, channelId, message) {
    const announcement = this.announcements[userId];

    if (userId === this.approver_user_id) {
      this.web.chat.postMessage(channelId, 'Hi! I will be sure to let you know if someone submits a query request!');
    } else if (!announcement) {
      // no announcement found. Start the announcements process
      this.web.chat.postMessage(channelId, `:wave: Hello! I'm here to help your team execute Prod SQL queries`, {
        attachments: [
          {
            text: 'Do you have a SQL query to execute on Prod?',
            callback_id: 'startAnnouncement',
            actions: [
              {
                name: 'start',
                text: 'Submit query',
                type: 'button',
                value: 'startAnnouncement',
              },
            ],
          },
        ],
      });
    } else {
      // set the announcement text and metadata
      announcement.text = message;
      announcement.isApproved = false;
      announcement.channel = channelId;  // channel ID of the DM with the announcement author

      this.web.chat.postMessage(channelId, 'Got it!', {
        attachments: [
          {
            mrkdwn_in: ['pretext', 'text'],
            pretext: '*Query Preview*',
            text: announcement.text,
          },
          {
            text: `Should I send this query to <@${this.approver_user_id}> for approval?`,
            callback_id: `confirmAnnouncement:${userId}`,
            actions: [
              {
                name: 'sendToAdmin',
                text: 'Send it in!',
                type: 'button',
                value: 'sendToAdmin',
              },
              {
                name: 'retryAnnouncement',
                text: 'Try again',
                type: 'button',
                value: 'retry',
              },
              {
                name: 'cancelAnnouncement',
                text: 'Nevermind, cancel it',
                type: 'button',
                value: 'cancel',
              },
            ],
          },
        ],
      });
    }
  },

  startAnnouncement(userId) {
    if (this.announcements[userId]) {
      return Promise.resolve({
        text: 'You already have a query request in progress.',
        replace_original: false,
      });
    }

    // create announcement placeholder
    this.announcements[userId] = {};

    return Promise.resolve({
      text: 'Great! Just type your intended SQL query as a message to me.',
    });
  },

  confirmAnnouncement(userId, actionValue) {
    if (actionValue === 'sendToAdmin') {
      this.sendApprovalRequest(userId);
      return Promise.resolve({
        text: 'Your request has been sent to the admin for approval.',
      });
    }

    delete this.announcements[userId];

    if (actionValue === 'retry') {
      return this.startAnnouncement(userId);
    }

    return Promise.resolve({
      text: 'Query cancelled! Come on back anytime.',
    });
  },

  sendApprovalRequest(requesterId) {
    const announcement = this.announcements[requesterId];
    this.web.im.open(this.approver_user_id)
      .then(res => this.web.chat.postMessage(res.channel.id, `A query is requested by <@${requesterId}>.`, {
        attachments: [
          {
            mrkdwn_in: ['pretext', 'text'],
            pretext: '*Query Preview*',
            text: announcement.text,
          },
          {
            text: `Would you like to approve <@${requesterId}>'s' query?`,
            callback_id: `processAnnouncement:${requesterId}`,
            actions: [
              {
                name: 'approve',
                text: 'Approve',
                type: 'button',
                value: 'approve',
              },
              {
                name: 'deny',
                text: 'Deny',
                type: 'button',
                value: 'deny',
              },
            ],
          },
        ],
      })
    );
  },

  processAnnouncement(requesterId, approvalAction) {
    return new Promise((resolve, reject) => {
        const announcement = this.announcements[requesterId];

        if (approvalAction === 'approve') {
          announcement.isApproved = true;
        }
        else{
          announcement.isApproved = false;
        }
        console.log('isApproved', announcement.isApproved);

        if (announcement.isApproved) {

          mysqlutil.executeQuery(announcement.text).then((results, fields) => {

            this.web.chat.postMessage(announcement.channel,
              ':tada: Your query has been executed! :tada:', {
                attachments: [
                  {
                    mrkdwn_in: ['pretext', 'text'],
                    pretext: '*Results:* ' + JSON.stringify(results),
                    text: announcement.text,
                  },
                ],
              }
            );
            resolve({
              text: `:tada: <@${requesterId}>'s query has been executed! :tada: I'll let <@${requesterId}> know.`,
              attachments: [
                    {
                      mrkdwn_in: ['pretext', 'text'],
                      pretext: '*Results:* ' + JSON.stringify(results),
                      text: announcement.text,
                    },
                  ]
             });
            delete this.announcements[requesterId];
          }).catch((error) => {
             this.web.chat.postMessage(announcement.channel,
              ':x: Error in executing your query!', {
                attachments: [
                  {
                    mrkdwn_in: ['pretext', 'text'],
                    pretext: `*${error.code}*: ${error.sqlMessage}`,
                    text: announcement.text,
                  },
                ],
              }
            );
            resolve({
              text: `:x: Error in executing <@${requesterId}>'s query! I'll let <@${requesterId}> know.`,
              attachments: [
                    {
                      mrkdwn_in: ['pretext', 'text'],
                      pretext: `*${error.code}*: ${error.sqlMessage}`,
                      text: announcement.text,
                    },
                  ]
             });
            delete this.announcements[requesterId];
          });
        } else { // Not approved
          this.web.chat.postMessage(announcement.channel,
            ':pensive: Your query was rejected.', {
              attachments: [
                {
                  mrkdwn_in: ['pretext', 'text'],
                  pretext: '*Query Preview*',
                  text: announcement.text,
                },
              ],
            }).then(() => { delete this.announcements[requesterId]; });
          
          resolve({
            text: `:pensive: Rejected <@${requesterId}>'s query! I'll let <@${requesterId}> know.`,
            attachments: [
                  {
                    mrkdwn_in: ['pretext', 'text'],
                    pretext: '*Query Preview*',
                    text: announcement.text,
                  },
                ]
         });
        }
    });
    
  },

  postAnnouncement(userId) {
    const announcement = this.announcements[userId];
    if (announcement.isApproved) {
      return axios.post(process.env.SLACK_WEBHOOK_URL, {
        text: `:loudspeaker: Announcement from: <@${userId}>`,
        attachments: [
          {
            text: announcement.text,
            footer: 'DM me to make announcements here.',
          },
        ],
      }).then(() => { delete this.announcements[userId]; }
      ).then(() => Promise.resolve({ text: 'Your announcement has been posted!' }));
    }

    delete this.announcements[userId];
    return Promise.resolve({ text: ':thinking_face: That announcement can\'t be posted. Sorry about that! DM me and let\'s try again.' });
  },
};

module.exports = bot;
