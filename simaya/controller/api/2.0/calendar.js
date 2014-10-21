module.exports = function(app){
  var utils = require("../../../../sinergis/controller/utils.js")(app)
  var calendarWeb = require("../../calendar.js")(app)
  var calendar = require("../../../models/calendar.js")(app)
  var moment = require("moment")
  var ObjectID = app.ObjectID;

  // Wraps letter's res
  var ResWrapper = function(callback) {
    return {
      send: function(data) {
        callback(data)
      }
    }
  };


  /**
   * @api {get} /calendar/list Gets list of calendar events
   * @apiName ListCalendar
   * @apiGroup Calendar
   *
   * @apiVersion 0.1.0
   *

   * @apiParam {Date} date Start date in ISO format
   * @apiParam {Number} num-days Number of days to get
   *
   * @apiSuccess {Object[]} events List of calendar events
   * @apiSuccess {String} events.title Title of event
   * @apiSuccess {String[]} events.recipients Usernames of the recipients of the event (optional)
   * @apiSuccess {String[]} events.recipientsResolved Full names of the event recipients (optional)
   * @apiSuccess {Date} events.start Start time of the event
   * @apiSuccess {Date} events.end End time of the event
   * @apiSuccess {String} events.description Description of the event
   * @apiSuccess {Number} events.status Status of the event
   * @apiSuccess {Number} events.visibility Visibility of the event
   * @apiSuccess {Number} events.reminder The reminder of the event
   * @apiSuccess {Number} events.recurrence The recurrence of the event   
   */
  var list = function(req, res) {
    if (isNaN(new Date(req.query.date).valueOf())) {
      res.send(400, {
        meta: {
          code: 400,
          data: "Invalid request"
        }
      });
      return;
    }
    var r = ResWrapper(function(data) {
      var obj = {
        meta: {
          code: 200,
        },
        data: JSON.parse(data)
      }

      res.send(obj);
    });
    calendarWeb.listDayJSONApi(req, r);
  }

  /**
   * @api {post} /calendar/create Creating calendar using necessary data
   * @apiVersion 0.1.0
   * @apiName CreateCalendar
   * @apiGroup Calendar
   * @apiExample Example usage: 
   * curl -v "http://localhost:3000/api/2/calendar/create?access_token=glmzf8I5vN0O9CNMNNyFE2KWQaYecqkX8SF5srTUFyt5ManCYYPxX31UmQTZSnsfdJaLtbM8VaKgCKLKbXmSbWbM4lK01bW9ybrSmr8qaSrkry5RK9IXFz36cA6SVFWC" -F "fileAttachments=@C:\Users\beningranum\Desktop\simaya.txt" -F "id=" -F "title=ada deh 1" -F "startDate=20/07/2014" -F "startTime=0200" -F "endDate=20/07/2014" -F "endTime=0230" -F "recipients=testuser3,testuser4"
   *
   */

  var create = function(req, res) {
    var r = ResWrapper(function(data) {
      var obj = {
        meta: {
          code: 200,
        },
        data: JSON.parse(data)
      }
      res.send(obj);
    });
    calendarWeb.newJSON(req, r);
  }

 var remove = function(req, res) {

  var obj = {
        meta: { code: "200"},
        data:{}
  }

   if (req.query.id_calender) {
      calendar.remove(req.query.id_calender,req, function(r) {
        if(r===true){
          obj.data.success = true;
          res.send(obj);
        }else if(r==="error1"){
          obj.data.success = false;
          obj.data.info = "Calender bukan milik anda";
          res.send(obj);
        }else{
          obj.data.success = false;
          obj.data.info = "Calender tidak ditemukan";
          res.send(obj);
        }
      });
    } else {
      obj.data.success = false;
      obj.data.info = "id_calender required";
      res.send(obj);
    } 
  }

   var edit = function(req, res) {
    var r = ResWrapper(function(data) {
       if (data && data == "\"OK\"") {
        res.send({
          meta: {
            code: 200
          }
        });
      } else if (data && JSON.parse(data).Data) {
        res.send(400, {
          meta: {
            code: 400,
            data: "Invalid request: " + JSON.parse(data).Data.join(",")
          }
        });
      } else {
        res.send(400, {
          meta: {
            code: 400,
            data: "Invalid request"
          }
        });
      }
    });
     calendarWeb.editCalender(req,res);
  }

  var downloadAttachment = function(req, res) {
    var vals = {};
    
    if (req.params.id) {
      calendar.downloadAttachment(req.params.id, res);
    } else {
      res.send(404, {
          meta: {
            code: 404,
            data: "File Not Found"
          }
        });
    }
  }

  return {
    list: list,
    create: create,
    remove: remove,
    edit :edit,
    downloadAttachment: downloadAttachment
  }
}
