module.exports = function(app) {
  // Private 
  var db = app.db('user');
  var moment = require('moment');
  var fs = require('fs');
   var utils = require('../../sinergis/controller/utils.js')(app)
  , user = require('../../sinergis/models/user.js')(app)
  , mUtils = require('../models/utils.js')(app)
  , contacts = require('../models/contacts.js')(app)
  , ObjectID = app.ObjectID
  , base64Stream = require("base64-stream")
  , openUri = require("open-uri")

  require("js-object-clone");

  // for copying socials in modifyProfile  
  require('../models/deepCopy.js');
  
  var associateEmails = function(count, username, req, res, callback) {
    if (typeof(req.body["profile.emails"]) == "string") {
      req.body["profile.emails"] = [req.body["profile.emails"]];
    }
    if (count < req.body["profile.emails"].length) {
      user.associateEmail(username, req.body["profile.emails"][count], function(token, v) {
        user.activateEmailAssociation(token, req.body["profile.emails"][count], function(r) {
          associateEmails(count + 1, username, req, res, callback);
        })
      })
    } else {
      callback();
    }
  }
  
  // Public API
  return {

    // Edit Profile
    edit: function(req,res, callback) {
      // db.update({_id: req.session.currentUserProfile.id}, {$set: data}, function(err, updated) {
      //   if( err || !updated ) callback(req.session.currentUserProfile.id);
      //   else callback();
      // });
     var vals = { 
        username: req.session.currentUser,
        requireAdmin: true
      }
        
    vals.user = {
      profile: Object.clone(req.session.currentUserProfile, true)
    } 
    if (Object.keys(req).length > 0) {
      var oldProfile = req.session.currentUserProfile;
      if (req.body["profile.phones"]) {
        if (typeof(req.body["profile.phones"]) == "string") {
          req.body["profile.phones"] = [ req.body["profile.phones"] ];
        }
        oldProfile.phones = req.body["profile.phones"];
      }
      if (req.body["profile.address"]) {
        oldProfile.address = req.body["profile.address"];
      }
      if (req.body["profile.dates"]) {
        oldProfile.dates = req.body["profile.dates"];
      }
      if (req.body["profile.website"]) {
        oldProfile.website = req.body["profile.website"];
      }
      if (req.body["profile.npwp"]) {
        oldProfile.npwp = req.body["profile.npwp"];
      }
      if (req.body["profile.nik"]) {
        oldProfile.nik = req.body["profile.nik"];
      }
      vals.user.profile = Object.clone(oldProfile, true);
      if (req.body["profile.socials.type"]) {
        var socials = []
        vals.user.profile.socials = [];
        if (typeof(req.body["profile.socials.type"]) === "string") {
          if (req.body["profile.socials.value"]) {
            socials.push({
              type: req.body["profile.socials.type"],
              value: req.body["profile.socials.value"],
            })
            vals.user.profile.socials.push({
              type: req.body["profile.socials.type"],
              value: req.body["profile.socials.value"] 
            })
            vals.user.profile.socials[req.body["profile.socials.type"] + "Selected"] = "selected";
          }
        } else {
          for (var i = 0; i < req.body["profile.socials.type"].length; i ++) {
            if (req.body["profile.socials.value"][i]) {
              socials.push({
                type: req.body["profile.socials.type"][i],
                value: req.body["profile.socials.value"][i],
              })
              vals.user.profile.socials.push({
                type: req.body["profile.socials.type"][i], 
                value: req.body["profile.socials.value"][i] 
              })
              vals.user.profile.socials[i][req.body["profile.socials.type"][i] + "Selected"] = "selected";
            }
          }
        }
      }
      oldProfile.socials = Object.clone(socials, true);

      if(req.body["profile.dates"]){
        if(req.body["profile.dates"].birthday){
          vals.dateBirthdayDijit = req.body["profile.dates"].birthday; 
        }

        if(req.body["profile.dates"].special){
          vals.dateSpecialDijit = req.body["profile.dates"].special; 
        }
      }
      
      var modifyProfile2ndStage = function() {
        user.modifyProfile(vals.username, oldProfile, function(v) {
          vals.user.profile.class = mUtils.convertClass(vals.user.profile.class);

          if (req.body["profile.emails"]) {
            if (typeof(req.body["profile.emails"]) == "string") {
              req.body["profile.emails"] = [ req.body["profile.emails"] ];
            }
            user.emailList(vals.username, function(list) {
              var deleted = [];
              var hash = {};
              for (var i = 0; i < req.body["profile.emails"].length; i++) {
                hash[req.body["profile.emails"][i]] = 1;
              }
              for (var i = 0; i < list.length; i ++) {
                if (hash[list[i].email] != 1) {
                  deleted.push(list[i].email);
                }
              }
              vals.user.profile.emails = [];
              Object.keys(hash).forEach(function(e) {
                vals.user.profile.emails.push(e);
              })
              associateEmails(0, vals.username, req, res, function() {
                if (deleted.length > 0) {
                  user.disassociateEmail(vals.username, deleted, function(r) {
                     callback("ok");
                  })
                } else {
                   callback("ok");
                }
              })
            })
          } else {
             callback("ok");
          }
        })
      }

      if (req.files["profile.avatar"] && typeof(req.files["profile.avatar"]) !== "undefined" && req.files["profile.avatar"].name != "") {
        var exec = require('child_process').exec;
        var child;
        child = exec("mogrify -resize 512 " + req.files["profile.avatar"].path, function() {
          var fileId = new ObjectID();
          var store = app.store(fileId, "w");
          var fd = fs.openSync(req.files["profile.avatar"].path, "r");
          store.open(function(error, gridStore) {
            gridStore.writeFile(fd, function(error, result) {
              fs.unlinkSync(req.files["profile.avatar"].path);
              oldProfile.avatar = result.fileId;
              modifyProfile2ndStage();
            })
          });
        })
      } else {
        modifyProfile2ndStage();
      }
    } else {

      
      user.list({ search: {username: vals.username}}, function(r) {
        console.log("r[0] = " + JSON.stringify(r[0]));
        vals.user = r[0];
        if (typeof(vals.user.profile.dates) === "undefined" || 
            (vals.user.profile.dates && typeof(vals.user.profile.dates.birthday) === "undefined")) {
          var d = new Date(1970, 1, 1);
          vals.dateBirthdayDijit = moment(d).format("YYYY-MM-DD");
        } else {
          vals.dateBirthdayDijit = vals.user.profile.dates.birthday;
        }
        if (typeof(vals.user.profile.dates) === "undefined" || 
            (vals.user.profile.dates && typeof(vals.user.profile.dates.special) === "undefined")) {
          var d = new Date();
          vals.dateSpecialDijit = moment(d).format("YYYY-MM-DD");
        } else {
          vals.dateSpecialDijit = vals.user.profile.dates.special;
        }
 
        if (vals.user.profile.socials) {
          for (var i = 0; i < vals.user.profile.socials.length; i ++) {
            vals.user.profile.socials[i][vals.user.profile.socials[i].type + "Selected"] = "selected";
          }
        }

        var hash = {}
        user.emailList(vals.username, function(list) {
          for (var i = 0; i < list.length; i ++) {
            hash[list[i].email] = 1;
          }
          vals.user.profile.emails = [];
          Object.keys(hash).forEach(function(e) {
            vals.user.profile.emails.push(e);
          })
          vals.user.profile.class = mUtils.convertClass(vals.user.profile.class);
          callback("ok");
        })
      });
    }
      
    },

  }
}
