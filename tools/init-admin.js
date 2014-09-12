var settings = require('../settings.js')

var app = {
  db: function(modelName) {
    return settings.model(settings.db, modelName);
  }
  , ObjectID: settings.ObjectID
  , validator: settings.validator
}
var user = require('../sinergis/models/user.js')(app);
settings.db.open(function(){
  user.create({username : 'admin', password : 'test1234', password2 : 'test1234', profile : {}}, function(v) {
    if (v.hasErrors() == false) {
      user.addRole("admin", "admin", function(r) {
        user.setActive("admin", function() {
          console.log("User admin is created");
          process.exit();
        });
      });
    } else {
      console.log(v.errors);
      process.exit();
    }
  });
});
