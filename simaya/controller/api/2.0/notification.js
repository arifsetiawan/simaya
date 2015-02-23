module.exports = function(app) {
  var notification = require('../../../models/notification.js')(app)
    , notificationWeb = require('../../notification.js')(app)
    , utils = require('../../../../sinergis/controller/utils.js')(app)
    , moment= require('moment')
    
  /**
   * @api {get} /notifications Lists notifications
   * @apiName List
   *
   * @apiVersion 0.1.0
   * @apiPermission token
   *
   * @apiGroup Notification
   * @apiSuccess {Object[]} result Notification list
   * @apiSuccess {Boolean} result.isRead Whether the notification is explicitly read
   * @apiSuccess {String} result._id Object id of the notification
   * @apiSuccess {String} result.message Notification message
   * @apiSuccess {Date} result.time Notification time
   * @apiSuccess {String} result.url Notification url
   */
  var list = function(req, res) {
    notification.getAll(req.session.currentUser, function(r) {
      if (r) {
        for (var i = 0; i < r.length; i ++) {
          r[i].formattedTime = moment(r[i].time).format("dddd, DD MMMM YYYY HH:ss");
        }
        res.send({
          meta: {
            code: 200
          },
          data: r
        });
      } else {
        res.send({
          meta: {
            code: 500,
            data: "Server error"
          }
        });
      }
    });
  }

  /**
   * @api {get} /notifications/view Views a notification
   * @apiName View
   *
   * @apiVersion 0.1.0
   *
   * @apiPermission token
   * @apiGroup Notification
   * @apiDescription Views a notification, this will clear notification status and sends push notification to all supported platforms
   * @apiSuccess {Object[]} result Notification information
   * @apiSuccess {Boolean} result.isRead Whether the notification is explicitly read
   * @apiSuccess {String} result._id Object id of the notification
   * @apiSuccess {String} result.message Notification message
   * @apiSuccess {Date} result.time Notification time
   * @apiSuccess {String} result.url Notification url
   */
  var view = function(req, res) {
    if (req.params.id) {
      notification.view(req.params.id, function(r) {
        console.log(r)
        res.send({
          meta: {
            code: 200,
          },
          data: r
        });
      })
    } else {
      res.send(400, {
        meta: {
          code: 400,
          data: "Invalid request"
        }
      });
    }
  }

   /**
   * @api {del} /notifications/removeAll Remove All Notification
   * @apiVersion 0.1.0
   * @apiName DeclineInvitationCalendar
   * @apiGroup Calendar
   * @apiPermission token
  */
  var removeAll = function(req,res){
    var obj = {
                meta : { code : "200" },
                data : {}
              }

     notification.removeAll(req.session.currentUser, function(r) {
        obj.data.success = true;
        res.send(obj);
    });
  }
   
  return {
    list: list,
    view: view,
    removeAll:removeAll
  }
};
