var mysql      = require('mysql');
var connectOpts = {
      host     : process.env.MYSQL_HOST,
      user     : process.env.MYSQL_USER,
      password : process.env.MYSQL_PASS,
      database : process.env.MYSQL_DB,
      multipleStatements: true
    };

var executeQuery = function executeQuery(queryStr){
  return new Promise((resolve, reject) => {
    if(!queryStr || queryStr == ''){
      reject('Query string is empty');
      return;
    }
    
    queryStr = preProcessQuery(queryStr);
    
    var connection = mysql.createConnection(connectOpts);
    
    connection.query(queryStr, (error, results, fields) => {
      connection.end();
      if(error){
        console.error(queryStr, error.code, error.sqlMessage);
        reject(error);
        return;
      }
      console.log(queryStr, 'results: ', results);
      resolve(results, fields);
    });
  });
}

//“2017-06-01” ‘2017-06-01’
var preProcessQuery = function(queryStr){
  queryStr = replaceAll(queryStr, '>', ''); //Slack wraps urls with angle braces like <http://google.com>
  queryStr = replaceAll(queryStr, '<', '');
  
  queryStr = replaceAll(queryStr, '&gt;', '>');
  queryStr = replaceAll(queryStr, '&lt;', '<');
  queryStr = replaceAll(queryStr, '&amp;', '&');
  queryStr = replaceAll(queryStr, '”', '"');
  queryStr = replaceAll(queryStr, '“', '"');
  queryStr = replaceAll(queryStr, '‘', "'");
  queryStr = replaceAll(queryStr, '’', "'");
  
  return queryStr;
}

var replaceAll = function(string, find, replace) {
  return string.replace(new RegExp(escapeRegExp(find), 'g'), replace);
};

function escapeRegExp(string) {
  return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

module.exports.executeQuery = executeQuery
module.exports.replaceAll = replaceAll;
