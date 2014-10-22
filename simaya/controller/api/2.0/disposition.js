module.exports = function(app){

  var dispositionWeb = require("../../disposition.js")(app)
  var disposition = require("../../../models/disposition.js")(app)
  var letterUtils = require("../../../models/utils.js")(app)
    , notification = require('../../../models/notification.js')(app)
    , ObjectID = app.ObjectID
    , moment= require('moment')
    , user = require('../../../../sinergis/models/user.js')(app)
    , cUtils = require('../../../../simaya/controller/utils.js')(app)
    , azuresettings = require("../../../../azure-settings.js");

  function isValidObjectID(str) {
    str = str + '';
    var len = str.length, valid = false;
    if (len == 12 || len == 24) {
      valid = /^[0-9a-fA-F]+$/.test(str);
    }
    return valid;
  }

  var create = function(req, res) {
     var obj = {
        meta : {  } ,
        data : {}
      }

    if (req.body.id &&
        req.body.recipients &&
        req.body.date &&
        req.body.instruction &&
        req.body.security &&
        req.body.priority &&
        req.body.message) {

      var recipients = [];

      for (var i = 0; i < req.body.recipients.length; i++) {
        var r = {
          recipient: req.body.recipients[i],
          date: new Date(req.body.date[i]),
          instruction: req.body.instruction[i],
          security: req.body.security[i],
          priority: req.body.priority[i],
          message : req.body.message[i],
        }
        recipients.push(r);
      }

      var data = {
        date: new Date(),
        letterId: req.body.id,
        inReplyTo: req.body.dispositionId,
        sender: req.session.currentUser,
        letterTitle: req.body.letterTitle,
        letterMailId: req.body.letterNumber,
        letterDate: req.body.letterDate,
        recipients: recipients,
      }

      disposition.create(data, function(e, v) {
        req.body.recipients.forEach(function(item) {
          notification.set(item, 'Ada disposisi perihal ' + req.body.letterTitle, '/disposition/read/' + v._id);
        });

          obj.meta.code = "200";
          obj.data.success = true;
          res.send(obj);
      });
    } else {
          obj.meta.code = "200";
          obj.data.success = false;
          obj.data.info = "id/recipients/date/instruction/security/priority/message required"
          res.send(obj);
    }
  }

  /**
   * @api {get} /dispositions/outgoings Outgoing Dispositions
   *
   * @apiVersion 0.1.0
   *
   * @apiName GetOutgoingDispositions
   * @apiGroup Dispositions
   * @apiPermission token
   *
   * @apiDescription Get outgoing dispositions
   * 
   * @apiParam {String} access_token The access token
   * @apiParam {String} page The <code>page-th</code> of result group
   * @apiParam {String} limit The maximum number of letters per page
   *
   * @apiExample URL Structure:
   * // FOR DEVELOPMENT
   * http://simaya.cloudapp.net/api/2/dispositions/outgoings
   * 
   * @apiExample Example usage:
   * curl http://simaya.cloudapp.net/api/2/dispositions/outgoings?access_token=f3fyGRRoKZ...
   */
  var outgoings = function(req, res) {
    var me = req.session.currentUser;
    var search = {
      search: {
        $and: [
        {$or: [
           { sender: me }
        ]},
        {$or: [
           { letterTitle: 
            { $regex : new RegExp(req.query.title, "i")}
          },
        ]}
        ],
      },
      limit: 20,
      page: (req.query["page"] || 1) 
    }
    listBase(search, req, res);
  }

  /**
   * @api {get} /dispositions/incomings Incoming Dispositions
   *
   * @apiVersion 0.1.0
   *
   * @apiName GetIncomingDispositions
   * @apiGroup Dispositions
   * @apiPermission token
   *
   * @apiDescription Get incoming dispositions
   * 
   * @apiParam {String} access_token The access token
   * @apiParam {String} page The <code>page-th</code> of result group
   * @apiParam {String} limit The maximum number of letters per page
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://simaya.cloudapp.net/api/2/dispositions/incomings
   * 
   * @apiExample Example usage:
   * curl http://simaya.cloudapp.net/api/2/dispositions/incomings?access_token=f3fyGRRoKZ...
   */
  var incomings = function(req, res) {
    var me = req.session.currentUser;
    var search = {
      search: {
        $and: [
        {$or: [
           { "recipients.recipient": me }
        ]},
        {$or: [
           { letterTitle: 
            { $regex : new RegExp(req.query.title, "i")}
          },
        ]}
        ],
      },
      limit: 20,
      page: (req.query["page"] || 1) 
    }
    listBase(search, req, res);
  }

  var listBase = function(search, req, res) {
    var me = req.session.currentUser;
    if (req.query.search && req.query.search.string) {
      search.search["$or"] = dispositionWeb.populateSearch(req.query.search.string);
    }
    disposition.list(search, function(r) {
      var recipientHash = {};
      r.forEach(function(e, i) {
        var d = moment(e.letterDate);
        if (d) {
          r[i].formattedDate = d.format('DD/MM/YYYY');
        }
        recipientHash[r[i].sender] = 1;
        if (r[i].letterDate) {
          r[i].letterDate =  moment(r[i].letterDate).format("dddd, DD MMMM YYYY");
        }

        if (r[i].created_at) {
          r[i].createdAtFull =  moment(r[i].created_at).format("dddd, DD MMMM YYYY");
        }

        for (var j = 0; j < r[i].recipients.length; j++) {
          recipientHash[r[i].recipients[j].recipient] = 1;
          r[i].recipients[j]['priority' + r[i].recipients[j].priority] = true;
          r[i].recipients[j]['security' + r[i].recipients[j].security] = true;

          // For incoming
          if (r[i].recipients[j].recipient == me) {
            r[i].completionDate = moment(r[i].recipients[j].date).format("DD/MM/YYYY");
            r[i].priority = r[i].recipients[j].priority;
            r[i].security = r[i].recipients[j].security;
            if (r[i].recipients[j].readDate) {
              r[i].readDate = true;
            }
            if (r[i].recipients[j].followedUpDate) {
              r[i].followedUpDate = true;
            }
            if (r[i].recipients[j].declinedDate) {
              r[i].declinedDate = true;
            }
          }
        }
      });

      letterUtils.resolveUsers(Object.keys(recipientHash), function(resolved) {
        var resolvedHash = {};
        resolved.forEach(function(e, i) {
          var key = resolved[i].username;
          resolvedHash[key] = resolved[i];
        });

        r.forEach(function(e, i) {
          for (var j = 0; j < r[i].recipients.length; j++) {
            var resolvedRecipient = resolvedHash[r[i].recipients[j].recipient]; 
            r[i].recipients[j].recipientResolved = resolvedRecipient.name;
          }

           r[i].fullName = resolvedHash[r[i].sender].name;
        });

        var obj = {
          meta : { code : 200 },
        }

        var data = r;

        var paginations = {
          current : { 
            count : data.length,
            limit : search.limit,  
            page : parseInt(search.page),
          }
        }

        if (search.page != 1) {
          paginations.previous = { page : search.page - 1};
        }

        obj.data = data;
        obj.paginations = paginations;

        if (data.length > 0) {
          if (data.length == search.limit) {
            search.page++;

            disposition.list(search, function(nextResult) {

              if (nextResult && nextResult.length > 0) {
                paginations.next = {
                  count : nextResult.length,
                  page : search.page
                }
              }

              obj.data = data;
              obj.paginations = paginations;
              return res.send(obj);
            });

          } else {
            return res.send(obj);
          }
        }
        else {
          res.send(obj);  
        }

      });
    });
  }

  /**
   * @api {get} /dispositions/:id Read a disposition
   *
   * @apiVersion 0.1.0
   *
   * @apiName GetReadADisposition
   * @apiGroup Dispositions
   * @apiPermission token
   *
   * @apiDescription Read a disposition
   * 
   * @apiParam {String} access_token The access token
   * @apiParam {String} id The disposition id
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://simaya.cloudapp.net/api/2/dispositions/:id
   * 
   * @apiExample Example usage:
   * curl http://simaya.cloudapp.net/api/2/dispositions/52ff37bc2b744cf14eacd2ab?access_token=f3fyGRRoKZ...
   *
   * @apiError DispositionNotFound 
   */
  var read = function (req, res) {

    var id = req.params.id;

    if(!isValidObjectID(id)) {

      var obj = {
        meta : { code : 400, errorMessage : "Invalid Parameters"}
      }

      return res.send(obj.meta.code, obj);
    }

    disposition.list({ search: {_id: app.ObjectID(id) } }, function(result) {

      var obj = {
        meta : { code : 200 } 
      }

      if (!result || result.length == 0) {
        
        obj.meta.code = 404;
        obj.meta.errorMessage = "Disposition Not Found";

        return res.send(obj.meta.code, obj);
      }

      obj.data = result[0];

      res.send(obj);

    });
  }

    var sendNotificationComments = function(currentUser, recipients, index, comment, url, callback) {
    if (typeof(recipients[index]) === "undefined") {
      callback();
      return;
    }
    if (currentUser != recipients[index].recipient) {
      notification.set(currentUser, recipients[index].recipient, comment, url, function() {
        sendNotificationComments(currentUser, recipients, index + 1, comment, url, callback); 
      })
    } else {
      sendNotificationComments(currentUser, recipients, index + 1, comment, url, callback); 
    }
  }


  var addComments = function(req,res){
    var data = {};
        data.meta = {};
        data.data = {};

    if (req.body && req.body.dispositionId && req.body.message) {
      var search = {
        search: {
          _id: ObjectID(req.body.dispositionId),
        }
      }
      disposition.list(search, function(result) { 
        if (result != null && result.length == 1) {
          disposition.addComments(ObjectID(req.body.dispositionId), req.session.currentUser, req.body.message, function(id) {
            if (id) {
              var message = req.session.currentUserProfile.fullName + ' mengomentari disposisi Anda.'
              sendNotificationComments(req.session.currentUser, result[0].recipients, 0, message, "/disposition/read/" + req.body.dispositionId + "#comments-" + id, function() {
                if (req.session.currentUser != result[0].sender) {
                  azuresettings.makeNotification(message, req.session.currentUserProfile.id);
                  notification.set(req.session.currentUser, result[0].sender, message, "/disposition/read/" + req.body.dispositionId + "#comments-" + id, function() {
                        data.meta.code = 200;
                        data.data.success = "ok";
                        res.send(200, data);
                  })
                } else {
                        data.meta.code = 200;
                        data.data.success = "ok";
                        res.send(200, data);
                }
              })
            } else {
                        data.meta.code = 400;
                        data.data.error = "error";
                        res.send(400, data);
            }
          });
        } else {
            data.meta.code = 400;
            data.data.error = "error";
            res.send(400, data);
        }
      });

    } else {
        data.meta.code = 400;
        data.data.error = "error";
        res.send(400, data);
    }
  }

  var getRecepeints = function(req,res){
    var myEchelonUp = ""+(parseInt(req.session.currentUserProfile.echelon) + 1);
    var myEchelon = req.session.currentUserProfile.echelon;
    var myOrganization = req.session.currentUserProfile.organization;
    var search = {
      search: {
        $or: [
        { 
          // people with administration role
          roleList: { $in: [app.simaya.administrationRole] },
          'profile.organization': myOrganization, // admins is in my org only, issue #173 
          'profile.echelon': { $gte:  myEchelonUp },  // up 
        },
        { 
          // other member
          roleList: { $nin: [app.simaya.administrationRole] },
          'profile.organization': { $regex: '^' + myOrganization} , // can span across orgs 
          'profile.echelon': { $gt: myEchelon, $lte: myEchelonUp + "e" },  // only exactly up or within the same echelon with lower rank 
        },
        ]
      },
    }

    if (req.query && req.query.letterId) {
      disposition.list({search: {letterId: req.query.letterId}}, function(result) {
        var recipients = [];
        if (result != null) {
          for (var i = 0; i < result.length; i++) {
            for (var j = 0; j < result[i].recipients.length; j++) {
              recipients.push (result[i].recipients[j].recipient);
            }
          }
          req.query.added = recipients;
        } 
        getUserList(search, req, res);
      });
    } else {
      getUserList(search, req, res);
    }
  }

  var getUserList = function(search, req, res) {
    user.list(search, function(r) {
      if (r == null) {
        r = [];
      }

      var added = [];
      if (req.query && req.query.added) {
        added = req.query.added
      }
      added.push(req.session.currentUser)

      var copy = cUtils.stripCopy(r, added);

      var obj = {
          meta : { code : 200 },
          data : {}
        }

      obj.data = copy;
      res.send(obj);
    });
  }

   var decline = function(req, res) {
     var obj = {
          meta : { code : 200 },
          data : {}
        }
    if (req.body && req.body.dispositionId && req.body.message) {
      var search = {
        search: {
          _id: ObjectID(req.body.dispositionId),
        }
      }
      disposition.list(search, function(result) { 
        if (result != null && result.length == 1) {
          disposition.markAsDeclined(ObjectID(req.body.dispositionId), req.session.currentUser, req.body.message, function(ok) {
            if (ok) {
              azuresettings.makeNotification(req.session.currentUserProfile.fullName + ' menolak disposisi dari Anda.', req.session.currentUserProfile.id);
              notification.set(req.session.currentUser, result[0].sender, req.session.currentUserProfile.fullName + ' menolak disposisi dari Anda.', '/disposition/read/' + req.body.dispositionId + "#recipient-" + req.session.currentUser);
              obj.data.success = true;
              res.send(obj);
            } else {
              obj.data.success = false;
              res.send(obj);
            }
          });
        } else {
            obj.data.success = false;
            obj.data.info = "Disposition ID tidak ditemukan";
            res.send(obj);
        }
      });
    } else {
      obj.data.success = false;
      obj.data.info = "Disposition ID and Message required";
      res.send(obj);
    }
  }

  return {
    incomings : incomings,
    outgoings : outgoings,
    read : read,
    addComments : addComments,
    create : create,
    getRecepeints : getRecepeints,
    decline: decline

  }
}