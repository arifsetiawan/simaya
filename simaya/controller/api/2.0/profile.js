module.exports = function(app){
  var utils = require("../../../../sinergis/controller/utils.js")(app)
  var user = require("../../../../sinergis/models/user.js")(app)
  var moment = require("moment")
  var ObjectID = app.ObjectID;
  var fs = require('fs');
  var notification = require('../../../models/notification.js')(app)
  var profileWeb = require('../../profile.js')(app)
      , contacts = require('../../../models/contacts.js')(app)
      , mUtils = require('../../../models/utils.js')(app)
      , db = app.db('user')
      , settings = require("../../../../settings.js");

  /**
   * @api {get} /profile/avatar View avatar of a username
   *
   * @apiVersion 0.1.0
   *
   * @apiName ViewAvatar
   * @apiGroup Profile
   * @apiPermission token
   *
   * @apiParam {String} username Username to view
   * @apiSuccess {Stream} Image stream 
   */
  var getAvatar = function(req, res) {
    profileWeb.getAvatarStream(req, res);
  }

  var getAvatarBase64 = function(req, res) {
    profileWeb.getAvatarBase64Stream(req, res);
  }

  var getFullName = function(req, res) {
    var data = {
      result: 0,
      value: req.session.currentUserProfile.fullName
    }
    res.send(JSON.stringify(data));
  }

  var getLoginName = function(req, res) {
    var data = {
      result: 0,
      value: req.session.currentUser
    }
    res.send(JSON.stringify(data));
  }

  /**
   * @api {get} /profile/view View profile of a username
   *
   * @apiVersion 0.1.0
   *
   * @apiName ViewProfile
   * @apiGroup Profile
   * @apiPermission token
   *
   * @apiParam {String} username Username to view
   * @apiSuccess {Object} data Profile data
   * @apiSuccess {Object} data.profile Full listing of profile information
   * @apiSuccess {String} data.username Username
   * @apiSuccess {String} data.notes Personal notes about this user
   */
  var view = function(req, res) {
    if (req.query.username) {
      user.list({ search: {username: req.query.username}}, function(r) {
        if (r && r.length == 1) {
          delete(r[0].password);
          delete(r[0].roleList);
          delete(r[0]._id);
          delete(r[0].active);
          delete(r[0].updated_at);
          delete(r[0].lastLogin);
          r[0].profile.class = mUtils.convertClass(r[0].profile.class);
          if (r[0].profile.dates) {
            if (r[0].profile.dates.birthday) {
              r[0].dateBirthday = moment(r[0].profile.dates.birthday).format("DD MMMM YYYY");
            }
            if (r[0].profile.dates.special) {
              r[0].dateSpecial = moment(r[0].profile.dates.special).format("DD MMMM YYYY");
            }
          }
          var me = req.session.currentUser;
          contacts.getNotes(me, req.body.username, function(notes) {  
            r[0].notes = notes;

            res.send({
              meta: {
                code: 200
              },
              data: r[0]
            });
          });
        } else {
          res.send(500, {
            meta: {
              code: 500,
              data: "Server error"
            }
          });
        }
      });
    } else {
      res.send(400, {
        meta: {
          code: 400,
          data: "Invalid parameters"
        }
      });
    }
  }

  /**
   * @api {post} /profile/save Saving profile of a username
   * @apiVersion 0.1.0
   * @apiName SaveProfile
   * @apiGroup Profile
   * @apiPermission token
   *
   *
   * @apiSuccess {Object} data Profile data
   * @apiSuccess {Object} data.profile Full listing of profile information
   * @apiSuccess {String} data.username Username
   * @apiSuccess {String} data.notes Personal notes about this user
   */

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

  var save = function(req, res) {
    var data = {};
    data.meta = {};
    if (req.user.id) {
      console.log(1)
      if (req.body) {
        var doc = {};
        var profile = req.session.currentUserProfile;
        delete profile.id;
        console.log(2)
        // data biasa
        if (req.body["profile.phones"]) {
          if (typeof(req.body["profile.phones"]) == "string") {
            req.body["profile.phones"] = [ req.body["profile.phones"] ];
          }
          profile.phones = req.body["profile.phones"];
          // console.log("OLDPROFILE = " + JSON.stringify(oldProfile));
        }
        if (req.body['profile.npwp']) {
          profile.npwp = req.body['profile.npwp'];
        }
        if (req.body['profile.nik']) {
          profile.nik = req.body['profile.nik'];
        }
        if (req.body['profile.address']) {
          profile.address = req.body['profile.address'];
        }
        if (req.body['profile.dates']) {
          profile.dates = req.body['profile.dates'];
        }
        if (req.body['profile.website']) {
          profile.website = req.body['profile.website'];
        }
        console.log(3)
        // data profile
        if (req.body["profile.socials.type"]) {
          console.log(4)
          var socials = [];
          if (typeof(req.body["profile.socials.type"]) === "string") {
            if (req.body["profile.socials.value"]) {
              socials.push({
                type: req.body["profile.socials.type"],
                value: req.body["profile.socials.value"],
              })
            }
          } else {
            for (var i = 0; i < req.body["profile.socials.type"].length; i ++) {
              if (req.body["profile.socials.value"][i]) {
                socials.push({
                  type: req.body["profile.socials.type"][i],
                  value: req.body["profile.socials.value"][i],
                })
              }
            }
          }
        }
        console.log(5)
        // data avatar
        if (req.files["profile.avatar"] && typeof(req.files["profile.avatar"]) !== "undefined" && req.files["profile.avatar"].name != "") {
          console.log(6)
          var exec = require('child_process').exec;
          var child;
          child = exec("mogrify -resize 512 " + req.files["profile.avatar"].path, function() {
            var fileId = new ObjectID();
            var store = app.store(fileId, "w");
            var fd = fs.openSync(req.files["profile.avatar"].path, "r");
            store.open(function(error, gridStore) {
              gridStore.writeFile(fd, function(error, result) {
                fs.unlinkSync(req.files["profile.avatar"].path);
                profile.avatar = result.fileId;
                console.log(7)
                // data email
                if (req.body["profile.emails"]) {
                  if (typeof(req.body["profile.emails"]) == "string") {
                    req.body["profile.emails"] = [ req.body["profile.emails"] ];
                  }
                  user.emailList(req.session.currentUser, function(list) {
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
                    associateEmails(0, req.session.currentUser, req, res, function() {
                      console.log(8)
                      if (deleted.length > 0) {
                        user.disassociateEmail(req.session.currentUser, deleted, function(r) {
                          console.log(profile);
                          //console.log("REQBODY = " + JSON.stringify(req.body));
                          
                          var collection = settings.db.collection("user");
                           collection.findAndModify({username: req.user.id}, {_id:1}, {$set:{'profile' : profile}}, {new:true}, function(err,doc) {
                            if (err) {
                              console.log(err);
                              data.meta.code = 500;
                              data.message = "Internal Server Error"
                              res.send(500, data);
                            }
                            if (doc) {
                              console.log(doc);
                              data.meta.code = 200;
                              data.message = "OK";
                              res.send(200, data);
                            }
                          });
                        })
                      }
                    })
                  })
                }else {
                  if (error) {
                    console.log(error);
                    data.meta.code = 500;
                    data.message = "Internal Server Error"
                    res.send(500, data);
                  }else {
                    data.meta.code = 200;
                    data.message = "OK";
                    res.send(200, data);
                  }
                }
              })
            });
          })
        } else {
          console.log(9)
          // data email tanpa avatar
          if (req.body["profile.emails"]) {
            if (typeof(req.body["profile.emails"]) == "string") {
              req.body["profile.emails"] = [ req.body["profile.emails"] ];
            }
            user.emailList(req.session.currentUser, function(list) {
              console.log(10)
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
              associateEmails(0, req.session.currentUser, req, res, function() {
                console.log(11)
                console.log('deleted',deleted)
                if (deleted.length > 0) {
                  user.disassociateEmail(req.session.currentUser, deleted, function(r) {
                    console.log(profile);
                    //console.log("REQBODY = " + JSON.stringify(req.body));
                    
                    var collection = settings.db.collection("user");
                    collection.findAndModify({username: req.user.id}, {_id:1}, {$set:{'profile' : profile}}, {new:true}, function(err,doc) {
                      console.log(12)
                      if (err) {
                        console.log(err);
                        data.meta.code = 500;
                        data.message = "Internal Server Error"
                        res.send(500, data);
                      }
                      if (doc) {
                        console.log(doc);
                        data.meta.code = 200;
                        data.message = "OK";
                        res.send(200, data);
                      }
                    });
                  })
                }else {
                  console.log(profile);
                  //console.log("REQBODY = " + JSON.stringify(req.body));
                  
                  var collection = settings.db.collection("user");
                  collection.findAndModify({username: req.user.id}, {_id:1}, {$set:{'profile' : profile}}, {new:true}, function(err,doc) {
                    console.log(12)
                    if (err) {
                      console.log(err);
                      data.meta.code = 500;
                      data.message = "Internal Server Error"
                      res.send(500, data);
                    }
                    if (doc) {
                      console.log(doc);
                      data.meta.code = 200;
                      data.message = "OK";
                      res.send(200, data);
                    }
                  });
                }
              })
            })
          }else {
            console.log(profile);
            //console.log("REQBODY = " + JSON.stringify(req.body));
            
            var collection = settings.db.collection("user");
             collection.findAndModify({username: req.user.id}, {_id:1}, {$set:{'profile' : profile}}, {new:true}, function(err,doc) {
              console.log(13)
              if (err) {
                console.log(err);
                data.meta.code = 500;
                data.message = "Internal Server Error"
                res.send(500, data);
              }
              if (doc) {
                console.log(doc);
                data.meta.code = 200;
                data.message = "OK";
                res.send(200, data);
              }
            });
          }
        }
      }
    }
  }

  return {
    getAvatar: getAvatar
    , getAvatarBase64: getAvatarBase64
    , getFullName: getFullName
    , getLoginName: getLoginName
    , view: view
    , save: save
  }
}
