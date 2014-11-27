var azure = require('azure');

// konstanta
//var hubname = "simaya-dev";
//var connectionstring = 'Endpoint=sb://jepret-ns.servicebus.windows.net/;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=i3r56ogOupPpcGZKlnVIqsTce8rDsf0z5XmdnjDLUFY=';

var hubname = "simaya";
var connectionstring = 'Endpoint=sb://simaya.servicebus.windows.net/;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=j5C7ZKBPnUc4bbMtRz1e2eRACOy8W1eXHC9LY12F0EA=';
  
var notificationHubService = azure.createNotificationHubService(hubname, connectionstring);

exports.makeNotificationWindows = function(message, id) {
	var payload = '<toast><visual><binding template="ToastText01"><text id="1">'+message+'</text></binding></visual></toast>';

	notificationHubService.wns.send("user_"+id, payload , 'wns/toast', function(error){
	  if(!error){
	    console.log(message+ " Pada Id : "+id);
	  }
	});
}

exports.makeNotification= function() {
	
}
