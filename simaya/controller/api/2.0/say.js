module.exports = function(app){

  var envelope = require("./envelope");

  var hello = function(req, res){
    envelope.wrap({ data : "hello" }, req, res);
  }

  var notification = function(req,res){
  	app.azureSettings.makeNotificationWindows("hai monika","5459bd3ca8e52e9b062d8feb");
  }
  
  return {
    hello : hello,
    notification : notification
  }
}