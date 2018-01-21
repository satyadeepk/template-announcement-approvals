var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : process.env.MYSQL_HOST,
  user     : process.env.MYSQL_USER,
  password : process.env.MYSQL_PASS,
  database : process.env.MYSQL_DB,
  multipleStatements: true
});

var executeQuery = function executeQuery(queryStr){
  return new Promise((resolve, reject) => {
    if(!queryStr || queryStr == ''){
      reject('Query string is empty');
      return;
    }
    
    connection.query(queryStr, (error, results, fields) => {
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


module.exports.executeQuery = executeQuery;
