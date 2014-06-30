var settings = require('../settings.js')

var app = {
  db: function(modelName) {
    return settings.model(settings.db, modelName);
  }
  , ObjectID: settings.ObjectID
  , validator: settings.validator
}
var user = require('../sinergis/models/user.js')(app);

user.changePassword('sri.mulyani', 'password', function(v) {
  if (v.hasErrors() == false) {
    console.log("User admin is reset");
    process.exit();
  } else {
    console.log(v.errors);
    process.exit();
  }
});

