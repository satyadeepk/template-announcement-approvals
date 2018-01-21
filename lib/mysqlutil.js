var mysql      = require('mysql');
var connection = mysql.createConnection(process.env.MYSQL_URL);

var executeQuery = function executeQuery(queryStr){
  return new Promise((resolve, reject) => {
    if(!queryStr || queryStr == ''){
      reject('Query string is empty');
      return;
    }
    
    connection.query(queryStr, (error, results, fields) => {
      if(error){
        console.error(queryStr, error);
        reject(error);
        return;
      }
      console.log(queryStr, 'results: ', results);
      resolve(results, fields);
    });
  });
}


module.exports.executeQuery = executeQuery;
