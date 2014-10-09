module.exports = function(app){

  var letterAPI = require("../1.0/letter")(app);
  var letterWeb = require("../../letter.js")(app);
  var letter = require("../../../models/letter.js")(app);
  var cUtils = require("../../utils.js")(app)
  var orgWeb = require("../../organization.js")(app)
  var db = app.db('letter');
  var dbUser = app.db('user');
  var dbdis = app.db('disposition');
  var utils = require("../../../../sinergis/controller/utils.js")(app)
  var ObjectID = app.ObjectID;
  var moment = require('moment');
  var async = require('async');
  var wrapper = null;
  // var letterMod = require("../../../model/letter.js")(app);

  function isValidObjectID(str) {
    str = str + '';
    var len = str.length, valid = false;
    if (len == 12 || len == 24) {
      valid = /^[0-9a-fA-F]+$/.test(str);
    }
    return valid;
  }

  // Wraps letter's res
  var ResWrapper = function(callback) {
    return {
      send: function(data) {
        callback(data)
      }
    }
  };

  var ResWrapperJSONParse = function(callback) {
    return {
      send: function(data) {
        callback(JSON.parse(data))
      }
    }
  };

 // List Type
 var type = {
  0 : "Peraturan",
  1 : "Pedoman",
  2 : "Petunjuk Pelaksanaan",
  3 : "Instruksi",
  4 : "Prosedur Tetap (SOP)",
  5 : "Surat Edaran",
  6 : "Keputusan",
  7 : "Surat Perintah/Surat Tugas",
  8 : "Nota Dinas",
  9 : "Memorandum",
  10 : "Surat Dinas",
  11 : "Surat Undangan",
  12 : "Surat Perjanjian",
  13 : "Surat Kuasa",
  14 : "Berita Acara",
  15 : "Surat Keterangan",
  16 : "Surat Pengantar",
  17 : "Pengumuman",
  18 : "Laporan",
  19 : "Lain-lain"
}

var list = function(search, req, res) {

  letterWeb.populateSearch(req, search, function(search) {

    letter.list(search, function(result){

      if (result == null) {

        var obj = {
          meta : {}
        }

        obj.meta.code = 404;
        obj.meta.errorMessage = "Letters Not Found";
        return res.send(obj.meta.code, obj);
      }

      letterAPI.extractData(result, req, res, function(result) {

        var obj = {
          meta : { code : 200 },
        }

        if (result == null) {
          obj.meta.code = 404;
          obj.meta.errorMessage = "Letters Not Found";
          return res.send(obj.meta.code, obj);
        }

        var data = result;

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

        if (result.length > 0) {

          if (result.length == search.limit) {

              // peek for next data
              search.page++;

              letter.list(search, function (nextResult) {

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
              obj.data = data;
              obj.paginations = paginations;
              res.send(obj);
            }
          } else {
            obj.data = data;
            obj.paginations = paginations;
            res.send(obj);
          }

        });

});
});
}

var countSuratMasuk = function(req, res, callback) {
  var search = letterWeb.buildSearchForIncoming(req, res);
  db.find(search.search, function(err, cursor) {
    if (cursor != null) {
      cursor.count(function(e, n) {
        callback(e,n);
      });
    }else {
      callback(0);
    }
  });
}

var countTembusan = function(req, res, callback) {
  var search = {
    ccList: {
      $in: [req.session.currentUser]
    },
  }
  var o = "receivingOrganizations." + req.session.currentUserProfile.organization + ".status";
  search[o] = letter.Stages.RECEIVED;
  db.find(search, function(err, cursor) {
    if (cursor != null) {
      cursor.count(function(e, n) {
        callback(e,n);
      });
    }else {
      callback(0);
    }
  });
}

var countDisposisiMasuk = function(req, res, callback) {
  var search = {
    search : {
      "recipients.recipient" : req.session.currentUser
    }
  }
  dbdis.find(search.search, function(err, cursor) {
    if (cursor != null) {
      cursor.count(function(e, n) {
          // console.log("CDM", n);
          callback(e,n);
        });
    }else {
      callback(0);
    }
  });
}

var countSuratKeluar = function(req, res, callback) {
  var search = letterWeb.buildSearchForOutgoing(req, res);
  db.find(search.search, function(err, cursor) {
    if (cursor != null) {
      cursor.count(function(e, n) {
        callback(e,n);
      });
    }else {
      callback(0);
    }
  });
}

var countKonsep = function(req, res, callback) {
  if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res)) {
    var search = {
      $or: [
      {
        senderOrganization: { $regex: "^" + req.session.currentUserProfile.organization } ,
            status: letter.Stages.APPROVED, // displays APPROVED and ready to be received
          },
          {
            $and: [
            {$or: [
              { originator: req.session.currentUser},
              { reviewers:
                { $in: [req.session.currentUser] }
              }
              ]},
              {$or: [
                { status: { $lte: letter.Stages.WAITING }, }, // displays new, in-review, and approved letters
                { status: letter.Stages.APPROVED } // displays new, in-review, and approved letters
                ]},
                ],
              }
              ],


              creation: "normal",
            }
          } else {
            var search = {
              $and: [
              {$or: [
                { originator: req.session.currentUser},
                { reviewers:
                  { $in: [req.session.currentUser] }
                }
                ]},
                {$or: [
          { status: { $lte: letter.Stages.WAITING }, }, // displays new, in-review, and approved letters
          { status: letter.Stages.APPROVED } // displays new, in-review, and approved letters
          ]},
          ],

          creation: "normal",
        }
      }
      db.find(search, function(err, cursor) {
        if (cursor != null) {
          cursor.count(function(e, n) {
            callback(e,n);
          });
        }else {
          callback(0);
        }
      });
    }

    var countBatal = function(req, res, callback) {
      var search = {
        $or: [
        { originator: req.session.currentUser},
        { reviewers:
          { $in: [req.session.currentUser] }
        }
        ],
        status: letter.Stages.DEMOTED,
        creation: "normal",
      }
      db.find(search, function(err, cursor) {
        if (cursor != null) {
          cursor.count(function(e, n) {
            callback(e,n);
          });
        }else {
          callback(0);
        }
      });
    }

    var countDisposisiKeluar = function(req, res, callback) {
      var search = {
        search : {
          sender : req.session.currentUser
        }
      }
      dbdis.find(search.search, function(err, cursor) {
        if (cursor != null) {
          cursor.count(function(e, n) {
            callback(e,n);
          });
        }else {
          callback(0);
        }
      });
    }

  /**
   * @api {get} /letters/incomings Incoming Letters
   *
   * @apiVersion 0.1.0
   *
   * @apiName GetIncomingLetters
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get incoming letters
   *
   * @apiParam {String} access_token The access token
   * @apiParam {String} page The <code>page-th</code> of result group
   * @apiParam {String} limit The maximum number of letters per page
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://simaya.cloudapp.net/api/2/letters/incomings
   *
   * @apiExample Example usage:
   * curl http://simaya.cloudapp.net/api/2/letters/incomings?access_token=f3fyGRRoKZ...
   */
   var incomings = function (req, res) {
    var search = letterWeb.buildSearchForIncoming(req, res);
    // console.log("Search1", JSON.stringify(search));
    search = letterWeb.populateSortForIncoming(req, search);
    // console.log("Search2", JSON.stringify(search));
    search.fields = { title : 1, priority : 1, classification : 1, date : 1, sender : 1, receivingOrganizations : 1, senderManual : 1, readStates : 1, mailId : 1};
    search.page = req.query["page"] || 1;
    search.limit = 20;
    // console.log("Search3", JSON.stringify(search));
    list(search, req, res);
  }

  /**
   * @api {get} /letter/incomingcount Getting number of how many incoming letters does the user have
   *
   * @apiVersion 0.1.0
   *
   * @apiName IncomingCount
   * @apiGroup Letters And Agendas
   * @apiPermission token
   * @apiSuccess {Object} status Status of the request
   * @apiSuccess {Boolean} status.ok "true" if success
   * @apiError {Object} status Status of the request
   * @apiError {Boolean} status.ok "false" if success
   */

   var incomingcount = function(req, res) {
    var data = {};
    data.meta = {};
    data.count = {};
    var incoming = cc = dispositionIncoming = 0;
    countSuratMasuk(req, res, function(err,result) {
      if (err) {
          // console.log(err);
          data.meta = 500;
          data.error = err;
          res.send(500, data);
        }
        else {
          incoming = result;
        }
        countTembusan(req, res, function(err, result) {
          if (err) {
            // console.log(err);
            data.meta = 500;
            data.error = err;
            res.send(500, data);
          }
          else {
            cc = result;
          }
          countDisposisiMasuk(req, res, function(err, result) {
            if (err) {
              // console.log(err);
              data.meta = 500;
              data.error = err;
              res.send(500, data);
            }
            else {
              dispositionIncoming = result;
            }
            // console.log(incoming, cc, dispositionIncoming);
            data.meta.code = 200;
            data.count.incoming = incoming;
            data.count.cc = cc;
            data.count.dispositionIncoming = dispositionIncoming;
            res.send(200, data);
          });
        });
      });
}

  /**
   * @api {get} /letters/outgoings Outgoing Letters
   *
   * @apiVersion 0.1.0
   *
   * @apiName GetOutgoingLetters
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get outgoing letters
   *
   * @apiParam {String} access_token The access token
   * @apiParam {String} page The <code>page-th</code> of result group
   * @apiParam {String} limit The maximum number of letters per page
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://simaya.cloudapp.net/api/2/letters/outgoings
   *
   * @apiExample Example usage:
   * curl http://simaya.cloudapp.net/api/2/letters/outgoings?access_token=f3fyGRRoKZ...
   */
   var outgoings = function (req, res) {
    var search = letterWeb.buildSearchForOutgoing(req, res);
    search.fields = {title: 1, priority : 1, classification :1, date: 1, sender: 1, receivingOrganizations: 1, senderManual: 1, readStates: 1, mailId : 1};
    search.page = req.query["page"] || 1;
    search.limit = 20;
    list(search, req, res);
  }

  /**
   * @api {get} /letter/outgoingcount Getting number of how many outgoing letters does the user have
   *
   * @apiVersion 0.1.0
   *
   * @apiName OutgoingCount
   * @apiGroup Letters And Agendas
   * @apiPermission token
   * @apiSuccess {Object} status Status of the request
   * @apiSuccess {Boolean} status.ok "true" if success
   * @apiError {Object} status Status of the request
   * @apiError {Boolean} status.ok "false" if success
   */

   var outgoingcount = function(req, res) {
    var data = {};
    data.meta = {};
    data.count = {};
    var outgoing = draft = demoted = dispositionOutgoing = 0;
    countSuratKeluar(req, res, function(err,result) {
      if (err) {
          // console.log(err);
          data.meta = 500;
          data.error = err;
          res.send(500, data);
        }
        else {
          outgoing = result;
        }
        countKonsep(req, res, function(err, result) {
          if (err) {
            // console.log(err);
            data.meta = 500;
            data.error = err;
            res.send(500, data);
          }
          else {
            draft = result;
          }
          countBatal(req, res, function(err, result) {
            if (err) {
              // console.log(err);
              data.meta = 500;
              data.error = err;
              res.send(500, data);
            }
            else {
              demoted = result;
            }
            countDisposisiKeluar(req, res, function(err, result) {
              if (err) {
                // console.log(err);
                data.meta = 500;
                data.error = err;
                res.send(500, data);
              }else {
                dispositionOutgoing = result;
              }
              // console.log(incoming, cc, dispositionIncoming);
              data.meta.code = 200;
              data.count.outgoing = outgoing;
              data.count.draft = draft;
              data.count.demoted = demoted;
              data.count.dispositionOutgoing = dispositionOutgoing;
              res.send(200, data);
            });
          });
        });
});
}

  /**
   * @api {get} /letter/read/:id Read a letter or agenda
   *
   * @apiVersion 0.1.0
   *
   * @apiName GetReadLetter
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get outgoing agendas
   *
   * @apiParam {String} access_token The access token
   * @apiParam {String} id The letter id
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://simaya.cloudapp.net/api/2/letters/:id
   *
   * @apiExample Example usage:
   * curl http://simaya.cloudapp.net/api/2/letters/52ff37bc2b744cf14eacd2ab?access_token=f3fyGRRoKZ...
   */
   var read = function(req, res) {

    var id = req.params.id;

    if(!isValidObjectID(id)) {

      var obj = {
        meta : { code : 400, errorMessage : "Invalid Parameters"}
      }

      return res.send(obj.meta.code, obj);
    }


    var search = letterWeb.buildSearchForViewing(id, req, res);

    letter.list(search, function(result){

      if (!result || result.length == 0) {

        var obj = {
          meta : { code : 404, errorMessage : "Letter Not Found"}
        }

        return res.send(obj.meta.code, obj);
      }

      letterAPI.extractData(result, req, res, function(result) {

        if (!result || result.length == 0) {

          var obj = {
            meta : { code : 404, errorMessage : "Letter Not Found"}
          }

          res.send(obj.meta.code, obj);
        }

        var obj = {
          meta : { code : 200 },
          data : result[0]
        }

        var me = req.session.currentUser;
        letter.setReadState(id, me);
        res.send(obj);

      });
    });

  }

  /**
   * @api {get} /agendas/incomings Incoming Agendas
   *
   * @apiVersion 0.1.0
   *
   * @apiName GetIncomingAgendas
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get incoming agendas
   *
   * @apiParam {String} access_token The access token
   * @apiParam {String} page The <code>page-th</code> of result group
   * @apiParam {String} limit The maximum number of letters per page
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://simaya.cloudapp.net/api/2/agendas/incomings
   *
   * @apiExample Example usage:
   * curl http://simaya.cloudapp.net/api/2/agendas/incomings?access_token=f3fyGRRoKZ...
   */
   var agendaIncomings = function (req, res){
    var search = {
      search: {}
    }
    search.fields = {title:1, date: 1, sender: 1, receivingOrganizations: 1, senderManual:1, readStates: 1};
    search.page = req.query["page"] || 1;
    search.limit = 20;

    var o = "receivingOrganizations." + req.session.currentUserProfile.organization + ".status";
    search.search[o] =  letter.Stages.RECEIVED; // The letter is received in this organization
    search = letterWeb.populateSortForIncoming(req, search);

    list(search, req, res);
  }

  /**
   * @api {get} /agendas/outgoings Outgoing Agendas
   *
   * @apiVersion 0.1.0
   *
   * @apiName GetOutgoingAgendas
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get outgoing agendas
   *
   * @apiParam {String} access_token The access token
   * @apiParam {String} page The <code>page-th</code> of result group
   * @apiParam {String} limit The maximum number of letters per page
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://simaya.cloudapp.net/api/2/agendas/outgoings
   *
   * @apiExample Example usage:
   * curl http://simaya.cloudapp.net/api/2/agendas/outgoings?access_token=f3fyGRRoKZ...
   */
   var agendaOutgoings = function (req, res){
    var search = {}
    search.fields = {title : 1, date : 1, sender: 1, receivingOrganizations: 1, senderManual:1, readStates: 1};
    search.page = req.query["page"] || 1;
    search.limit = 20;
    search.search = {
      senderOrganization: req.session.currentUserProfile.organization,
      $or: [
        {status: letter.Stages.RECEIVED}, // displays SENT or RECEIVED
        {status: letter.Stages.SENT}, // displays SENT or RECEIVED
        ],
        outgoingAgenda: { $ne: null }
      }

      list(search, req, res);
    }

    var attachments = function (req, res) {
      var id = req.params.id;

      if(!isValidObjectID(id)) {

        var obj = {
          meta : { code : 400, errorMessage : "Invalid Parameters"}
        }

        return res.send(obj);
      }

      var search = letterWeb.buildSearchForViewing(id, req, res);

      letter.list(search, function(result){

        if (!result || result.length == 0) {

          var obj = {
            meta : { code : 404, errorMessage : "Letter Not Found"}
          }

          return res.send(obj.meta.code, obj);
        }

        letterAPI.extractData(result, req, res, function(result) {

          if (!result || result.length == 0) {

            var obj = {
              meta : { code : 404, errorMessage : "Letter Not Found"}
            }

            res.send(obj.meta.code, obj);
          }

          var obj = {
            meta : { code : 200 },
            data : result[0].fileAttachments
          }

          var me = req.session.currentUser;
          letter.setReadState(id, me);
          res.send(obj);

        });
      });

    }

    var attachment = function (req, res) {
    // TODO: get attachment metadata, depends of its mime type
    // if (req.files) {
    //   var files = req.files.files;

    // if (files && files.length > 0) {

    //   var file = files[0];
    //   var metadata = {
    //     path : file.path,
    //     name : file.name,
    //     type : file.type
    //   };

    //   // uploads file to gridstore
    //   letterMod.saveAttachmentFile(metadata, function(err, result) {

    //     var file = {
    //       path : result.fileId,
    //       name : metadata.name,
    //       type : metadata.type
    //     };

    //     letter.addFileAttachment({ _id : ObjectID(req.body.draftId)}, file, function(err) {
    //       if(err) {
    //         file.error = "Failed to upload file";
    //       }

    //       // wraps the file
    //       var bundles = { files : []}
    //       file.letterId = req.body.draftId
    //       bundles.files.push(file)
    //       console.log(bundles);

    //       // sends the bundles!
    //       res.send(bundles);
    //     })

    //   })

    // }
    // }
  }

  var attachmentStream = function (req, res) {
    // TODO: stream the attachment, depends on its mime type
  }

  /**
   * @api {get} /letters/new Send a new letter for inspection
   *
   * @apiVersion 0.1.0
   *
   * @apiName SendNewLetter
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Send a new letter for inspection
   *
   * @apiParam {String} access_token The access token
   * @apiParam {Object} letter Letter information
   * @apiParam {String} letter.sender Sender name
   * @apiParam {Date} letter.date Letter's date
   * @apiParam {String} letter.mailId Letter's id
   * @apiParam {String} letter.title Letter's title
   * @apiParam {Number} letter.priority Letter's priority
   * @apiParam {Number} letter.classification Letter's classification
   * @apiParam {String} letter.comments Notes about the letter
   * @apiParam {Number} letter.type Letter's type
   * @apiParam {String} letter.recipients Comma separated recipient's usernames
   * @apiParam {String} ccList Comma separated CC's usernames
   * @apiParam {String} reviewers Comma separated reviewers' usernames
   *
   * @apiSuccess {Object} result Result of the operation
   * @apiSuccess {Number} result.code Code
   * @apiSuccess {Object} result.data Embedded data
   * @apiSuccess {Object} result.data.id Letter id if success
   * @apiSuccess {Object} result.data Cause of error if error
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://simaya.cloudapp.net/api/2/letters/new
   *
   * @apiExample Example usage:
   * curl -d "letter%5Bsender%5D=presiden.ri&letter%5Brecipients%5D=ketua.mpr&letter%5Btitle%5D=Jajal+api&letter%5Bclassification%5D=1&letter%5Bpriority%5D=1&letter%5Btype%5D=2&letter%5Bdate%5D=2014-03-05T08%3A37%3A30.956Z" http://simaya.cloudapp.net/api/2/letters/new?access_token=f3fyGRRoKZ...
   */
   var sendLetter = function(req, res) {
    /*console.log("reqbody",req.body);
    if (JSON.stringify(req.body) == '{}') {
      console.log("masuk!");
      var vals = {
        jsonRequest: true
      };
      var r = ResWrapper(function(data) {
        var obj = {
          meta: {
          }
        }
        // console.log(data);
        if (data.status == "ERROR" || data.result == "ERROR") {
          obj.meta.code = 400;
          obj.meta.data = "Invalid parameters: " + data.data.error;
        } else if (data.status == "OK" || data.result == "OK") {
          obj.meta.code = 200;
          obj.data = data.data;
        } else {
          obj.meta.code = 500;
          obj.meta.data = "Server error";
        }
        console.log(obj);
        // req.body.idDraft = obj.data.id;
        tempDraftId = obj.data.id;
        res.send(obj.meta.code, obj);
        // console.log("reqbody", req.body, "reqbodyiddraft", req.body.idDraft);
      });
    }else {
      console.log("masuk?");
      letterWeb.create({}, vals, "", letter.createNormal, req, r);
    }*/

    var vals = {
      jsonRequest: true
    };
    var r = ResWrapper(function(data) {
      var obj = {
        meta: {},
        data : {}
      }

      if (data.status == "ERROR" || data.result == "ERROR") {
        obj.meta.code = 400;
        obj.meta.data = "Invalid parameters: " + data.data.error;
        res.send(obj.meta.code, obj);
      } else if (data.status == "OK" || data.result == "OK") {

         db.findOne({_id:  ObjectID(data.data.id)}, function(error, result){
          if(result){
             dbUser.findOne({username:  result.nextReviewer}, function(error, result){
                  obj.meta.code = 200;
                  obj.data.id = data.data.id;
                  if(result){
                      obj.data.profile = result.profile;
                  }
                      res.send(obj.meta.code, obj);
              });
          }
        });    
      } else {
        obj.meta.code = 500;
        obj.meta.data = "Server error";
        res.send(obj.meta.code, obj);
      }

      // console.log("reqbody", req.body, "reqbodyiddraft", req.body.idDraft);
    });
    letterWeb.create({}, vals, "", letter.createNormal, req, r);
  }

  /**
   * @api {get} /letters/sender-selection Get a sender candidates selection list
   *
   * @apiVersion 0.1.0
   *
   * @apiName SenderSelection
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get a sender selection candidates list
   *
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Boolean} result.deputyActive Whether the candidate is a deputy
   * @apiSuccess {Object} result.profile Candidate profile
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://simaya.cloudapp.net/api/2/letters/sender-selection
   *
   * @apiExample Example usage:
   * curl http://simaya.cloudapp.net/api/2/letters/sender-selection?access_token=f3fyGRRoKZ...
   */
   var senderSelection = function(req, res) {
    var myOrganization = req.session.currentUserProfile.organization;
    var vals = {};
    cUtils.populateSenderSelection(myOrganization, "", vals, req, res, function(vals) {
      if (vals) {
        var obj = {
          meta: {
            code: 200
          },
          data: vals.senderSelection
        }
        res.send(200, obj);
      } else {
        var obj = {
          meta: {
            code: 500,
            data: "Server error"
          }
        }
        res.send(500, obj);
      }
    });

  }

  /**
   * @api {get} /letters/recipient-organization-selection Get a recipient candidates organization selection list
   *
   * @apiVersion 0.1.0
   *
   * @apiName RecipientOrganizationSelection
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get a recipient organization candidates selection list
   *
   * @apiParam {String} onlyFirstLevel If the value is set, only first level of the organization is returned
   * @apiParam {String} prefix The organization prefix of a certain organization, usually set to the first level name obtained by setting onlyFirstLevel
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Boolean} result.deputyActive Whether the candidate is a deputy
   * @apiSuccess {Object} result.profile Candidate profile
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://simaya.cloudapp.net/api/2/letters/recipient-organization-selection
   *
   * @apiExample Example usage:
   * curl http://simaya.cloudapp.net/api/2/letters/recipient-organization-selection?access_token=f3fyGRRoKZ...
   */
   var orgSelection = function(req, res) {
    var r = ResWrapperJSONParse(function(vals) {
      if (vals) {
        var obj = {
          meta: {
            code: 200
          },
          data: vals
        }
        res.send(obj);
      } else {
        var obj = {
          meta: {
            code: 500,
            data: "Server error"
          }
        }
        res.send(500, obj);
      }
    });

    orgWeb.list(req, r);
  }

  /**
   * @api {get} /letter/recipient-candidates-selection Gets recipient candidates when composing a letter
   * @apiName RecipientCandidatesSelection
   *
   * @apiVersion 0.1.0
   *
   * @apiGroup Letters And Agendas
   * @apiPermission token
   * @apiParam {String} org Organization of the candidates
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Boolean} result.deputyActive Whether the candidate is a deputy
   * @apiSuccess {Object} result.profile Candidate profile
   */
   var recipientCandidatesSelection = function(req, res) {
    var r = ResWrapperJSONParse(function(vals) {
      if (vals) {
        var obj = {
          meta: {
            code: 200
          },
          data: vals
        }
        res.send(obj);
      } else {
        var obj = {
          meta: {
            code: 500,
            data: "Server error"
          }
        }
        res.send(500, obj);
      }

    });

    letterWeb.getRecipientCandidates(req, r);
  }

  /**
   * @api {get} /letter/cc-candidates-selection Gets Cc candidates when composing a letter
   * @apiName CcCandidatesSelection
   *
   * @apiVersion 0.1.0
   *
   * @apiGroup Letters And Agendas
   * @apiPermission token
   * @apiParam {String} org Organization of the candidates
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Boolean} result.deputyActive Whether the candidate is a deputy
   * @apiSuccess {Object} result.profile Candidate profile
   */
   var ccCandidatesSelection = function(req, res) {
    var r = ResWrapperJSONParse(function(vals) {
      if (vals) {
        var obj = {
          meta: {
            code: 200
          },
          data: vals
        }
        res.send(obj);
      } else {
        var obj = {
          meta: {
            code: 500,
            data: "Server error"
          }
        }
        res.send(500, obj);
      }

    });

    letterWeb.getCcCandidates(req, r);
  }

  /**
   * @api {get} /letter/reviewer-candidates-selection Get reviewer candidates when composing a letter
   * @apiName ReviewerCandidatesSelection
   *
   * @apiVersion 0.1.0
   *
   * @apiGroup Letters And Agendas
   * @apiPermission token
   * @apiParam {String} org Organization of the candidates
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Object} result.profile Candidate profile
   */
   var reviewerCandidatesSelection = function(req, res) {
    var r = ResWrapperJSONParse(function(vals) {
      if (vals) {
        var obj = {
          meta: {
            code: 200
          },
          data: vals
        }
        res.send(obj);
      } else {
        var obj = {
          meta: {
            code: 500,
            data: "Server error"
          }
        }
        res.send(500, obj);
      }

    });

    letterWeb.getReviewerCandidates(req, r);
  }

  /**
   * @api {post} /letter/reject Rejects an incoming letter
   *
   * @apiVersion 0.1.0
   *
   * @apiName RejectLetter
   * @apiGroup Letters And Agendas
   * @apiParam {String} id Object Id of the letter
   * @apiSuccess {Object} status Status of the request
   * @apiSuccess {Boolean} status.ok "true" if success
   * @apiError {Object} status Status of the request
   * @apiError {Boolean} status.ok "false" if success
   */
   var rejectLetter = function(req, res) {
    var obj = {
      meta: {
      }
    }

    var r = ResWrapperJSONParse(function(data) {
      if (data.ok == true) {
        obj.meta.code = 200;
      } else {
        obj.meta.code = data.code;
      }
      console.log(data.code);
      res.send(obj);
    });
    letterWeb.reject(req, r);
  }

  // uploading attachment by user after the draftId has been created
  var uploadAttachment = function(req, res){

    var files = [];
    files.push(req.files.files);
    // console.log("files", files);
    console.log("idDraft", req.body.tempDraftId);
    tempDraftId = req.body.tempDraftId;

    if (files && files.length > 0) {

      var file = files[0];
      var metadata = {
        path : file.path,
        name : file.name,
        type : file.type,
        letterId : tempDraftId
      };

      // uploads file to gridstore
      letter.saveAttachmentFile(metadata, function(err, result) {

        var file = {
          path : result.fileId,
          name : metadata.name,
          type : metadata.type,
          letterId : metadata.letterId
        };

        letter.addFileAttachment({ _id : ObjectID(tempDraftId)}, file, function(err) {
          if(err) {
            file.error = "Failed to upload file";
          }

          // wraps the file
          var bundles = { files : []};
          // file.letterId = req.body.idDraft;
          bundles.files.push(file);
          // console.log(bundles);

          // sends the bundles!
          res.send(200, bundles);
        });

      });

    }else {
      res.send(500, {ok : false});
    }
  }

  // deleting the uploaded attachment one by one
  var deleteAttachment = function(req, res){

    var file = {}

    function fileStatus(message) {

      file.deleted = true;

      if (message) {
        file.deleted = false;
        file.error = message;
      }

      // wraps the file
      var bundles = { files : []}
      file.letterId = req.params.draftId
      file.attachmentId = req.params.attachmentId
      bundles.files.push(file)

      return res.send(bundles);
    }

    // if undefined returns an error
    if(!req.params.letterId && !req.params.attachmentId) {
      return fileError("Unable to delete file");
    }

    var letterId = ObjectID(req.params.letterId)

    letter.list({ search : { _id : letterId} }, function(letters) {
      if (letters.length > 0) {

        var fileAttachments = letters[0].fileAttachments
        var fileTobeDeleted;
        for (var i = 0; i < fileAttachments.length; i++) {
          if (fileAttachments[i].path == req.params.attachmentId) {
            fileTobeDeleted = fileAttachments[i];
            break;
          }
        }

        if (fileTobeDeleted) {

          // delete
          letter.removeFileAttachment({ _id : ObjectID(req.params.letterId)}, fileTobeDeleted, function(err) {

            if (err) {
              return fileStatus("File not found");
            }

            // returns file status OK
            return fileStatus();

          })
        } else {
          return fileStatus("File not found");
        }
      }
    })
  }

  var listOutgoingDraft = function(req,res){
    var search = {};
    var count = 0;
    if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res)) {
     search.search = {
      $or: [
      {
        senderOrganization: { $regex: "^" + req.session.currentUserProfile.organization } ,
            status: letter.Stages.APPROVED, // displays APPROVED and ready to be received
          },
          {
            $and: [
            {$or: [
              { originator: req.session.currentUser},
              { reviewers:
                { $in: [req.session.currentUser] }
              }
              ]},
              {$or: [
                { status: { $lte: letter.Stages.WAITING }, }, // displays new, in-review, and approved letters
                { status: letter.Stages.APPROVED } // displays new, in-review, and approved letters
                ]},
                ],
              }
              ],

              creation: "normal",
            }
          } else {
           search.search = {
            $and: [
            {$or: [
              { originator: req.session.currentUser},
              { reviewers:
                { $in: [req.session.currentUser] }
              }
              ]},
              {$or: [
          { status: { $lte: letter.Stages.WAITING }, }, // displays new, in-review, and approved letters
          { status: letter.Stages.APPROVED } // displays new, in-review, and approved letters
          ]},
          ],

          creation: "normal",
        }
      }
      search.page = req.query["page"] || 1;
      search.limit = req.query["limit"] || 20;

      letter.listOutgoingDraft(req,search,function(callback,callback2){
           callback.forEach(function(e, i) {
             callback[i] = {
                id_surat : callback[i]._id,
                tangal_diterima : moment(callback[i].date).format("dddd, DD MMMM YYYY"),
                nomer_surat : callback[i].mailId,
                jenis_surat : type[callback[i].type],
                atas_nama : callback[i].sender,
                perihal : callback[i].title,
                next_reviewers : callback[i].nextReviewer == req.session.currentUser ? true : false,
                priority : callback[i].priority,
                classification : callback[i].classification
            };
          });

          var obj = {
            meta : { code : 200 },
          }

          var data = callback;

          var paginations = {
            current : {
              count : data.length,
              limit : parseInt(search.limit),
              page : parseInt(search.page),
            }
          }

          obj.data = data;
          obj.paginations = paginations;
          res.send(obj);   
  });
}

var createAgendaSuratIncomings = function(req, res) {
    var vals = {};
    var obj = {
                meta : { code : "200" },
                data : {}
              }

    var id = req.params.id || req.body.id;

    if (id!=="" && req.body.incomingAgenda!=="") {
      var o = "receivingOrganizations." + req.session.currentUserProfile.organization + ".status";
      var search = {
        search: {
          _id: ObjectID(req.body.id),
        }
      }

       if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res) == true) {
        search.search[o] = letter.Stages.SENT;
        console.log(search);
        letter.list(search, function(result){
          if (result.length == 1) {
            vals.letter = result[0];
            Object.keys(result[0]).forEach(function(key){
              vals[key] = result[0][key];
            });

            if (req.body.incomingAgenda && req.body.incomingAgenda.length > 0) {
              var changes = result[0].receivingOrganizations;
              changes[req.session.currentUserProfile.organization] = {
                status: letter.Stages.RECEIVED,
                agenda: req.body.incomingAgenda,
                date: new Date(),
              }

              var count = 0;
              var all = 0;
              Object.keys(changes).forEach(function(item) {
                if (changes[item].status == letter.Stages.RECEIVED)
                  count ++;
                all ++;
              });


              var data = {
                receivingOrganizations: changes,
                log: [ {
                  date: new Date(),
                  username: req.session.currentUser,
                  action: "received",
                  message: "",
                  } ],
              }

              if (count == all) {
                data.status = letter.Stages.RECEIVED;
              }

              vals.letterReceived = true;
              letter.edit(req.body.id, data, function(v) {
                obj.data.success = true;
                res.send(obj);
              });
            } else {
                obj.data.success = false;
                obj.data.info = "Anda tidak memiliki hak akses untuk membuat nomer agenda";
                res.send(obj);
            }
          } else {
                obj.data.success = false;
                obj.data.info = "Anda tidak memiliki hak akses untuk membuat nomer agenda/Duplicate Entry";
                res.send(obj);
          }
        });

       }else{
            obj.data.success = false;
            obj.data.info = "Anda Bukan TU";
            res.send(obj);
       }
      
    } else {
            obj.data.success = false;
            obj.data.info = "ID letter and Nomer Agenda Surat Required";
            res.send(obj);
    }
  }

   var cancelLetter = function(req, res) {
     var obj = {
                  meta : { code : "200" },
                  data : {}
                }

    if (req.body && req.body.id_letter) {
      var search = {
        search: {
          _id: ObjectID(req.body.id_letter),
        }
      }
      letter.list(search, function(result){
        if (result != null && result.length == 1) {
          if (result[0].status == letter.Stages.WAITING) {

            if(result[0].nextReviewer == req.session.currentUser){
                  var data = {
                  status: letter.Stages.DEMOTED, 
                  log:  [{
                    date: new Date(),
                    username: req.session.currentUser,
                    action: "demoted",
                    message: "",
                    }]
                }
                letter.editForApi(req.body.id_letter, data, function(v) {
                  obj.data.success = true;
                  res.send(obj);
                })
            }else{
              if(req.body.message && result[0].originator == req.session.currentUser){
                 var data = {
                  status: letter.Stages.DEMOTED, 
                  log:  [{
                    date: new Date(),
                    username: req.session.currentUser,
                    action: "demoted",
                    message: req.body.message,
                    }]
                }
                 letter.editForApi(req.body.id_letter, data, function(v) {
                    obj.data.success = true;
                    res.send(obj);
                 })
              }else{
                if(result[0].originator == req.session.currentUser){
                  obj.data.success = false;
                  obj.data.info = "Message required";
                  res.send(obj);        
                }else{
                  obj.data.success = false;
                  obj.data.info = "Anda bukan pemiliki ID Letter";
                  res.send(obj);
                }

              }

            }
          }else{
            obj.data.success = false;
            obj.data.info = "Statusnya bukan waiting";
            res.send(obj);
          }
        }else{
            obj.data.success = false;
            obj.data.info = "ID Letter tidak ditemukan";
            res.send(obj);
        }
      })
    } else {
            obj.data.success = false;
            obj.data.info = "Letter ID required";
            res.send(obj);
    }
  }

  var rejectLetterNew = function(req,res){
      var obj = {
                  meta : { code : "200" },
                  data : {}
                }

    letter.rejectLetterNew(req.body.id_letter,req,function(v){
       if(v=="" || v==null){
          obj.data.success = true;
          res.send(obj);
       }else{
          obj.data.success = false;
          obj.data.info = v;
          res.send(obj);
       }
    });
  }

  var processLetter = function(req,res){
    var vals = {
      title: "Agenda Surat Masuk",
      currentUser: req.session.currentUser
    };
    var data = {};
    if (typeof(req.body.letter) !== "undefined") {

      letter.list({search: { _id: ObjectID(req.body.id)}}, function(result) {
        _letter = result[0];
        if(_letter == null || _letter ==""){
           var obj = {
                  meta : { code : "200" },
                  data : {}
                }

          obj.data.success = false;
          obj.data.info = "ID Letter tidak ada";
          res.send(obj);
        }else{
          vals.date = moment(_letter.date).format("DD/MM/YYYY");
          vals.dateDijit = moment(req.body.letter.date).format("YYYY-MM-DD") || moment(_letter.date).format("YYYY-MM-DD");
          vals.scope = _letter.creation;
          vals.letter = _letter;
          vals.draftId = req.body.id;

          if(_letter.fileAttachments){
            // copy file attachments
            data.fileAttachments = _letter.fileAttachments;
          }

          if(req.body.fileAttachments){
            for (var i = 0; i < req.body.fileAttachments; i++) {
              data.fileAttachments[i] = req.body.fileAttachments[i];
            };
          }

          Object.keys(result[0]).forEach(function(key){
              vals[key] = result[0][key];
          });

          // Convert string with comma separator to array
          if (req.body.letter.recipients != null) {
            data.recipients = req.body.letter.recipients.split(",");
          }

          if (req.body.letter.ccList != null) {
            data.ccList = req.body.letter.ccList.split(",");
          }

          if (req.body.autoCc) {
            var toConcat = {};
            for (var i = 0; i < req.body.autoCc.length; i ++) {
              toConcat[req.body.autoCc[i]] = 1;
            }
            for (var i = 0; i < data.ccList.length; i ++) {
              toConcat[data.ccList[i]] = 1;
            }
            data.ccList = []
            Object.keys(toConcat).forEach(function(e) {
              data.ccList.push(e);
            })
            if (data.creation == "external") {
              data.receivedByDeputy = true;
            } else {
              data.sentByDeputy = true;
            }
          }

          if (req.body.letter.originator != null) {
            data.originator = req.body.letter.originator;
          }

          vals["type" + parseInt(req.body.letter.type)] = "selected";
          data.type = parseInt(req.body.letter.type);

          // data.status = _letter.status;
          var currentReviewer = result[0].nextReviewer;
          data.reviewers = [];
          if (req.body.letter.reviewers != null) {
            var r = req.body.letter.reviewers.split(",");
            for (var i = 0; i < r.length; i++) {
              if (r[i] != req.body.letter.sender) {
                data.reviewers.push(r[i]);
              }
            }
            data.reviewers.push(req.body.letter.sender);
          }

          data.type = req.body.letter.type;
          vals["type" + parseInt(req.body.letter.type)] = "selected";

          data.nextReviewer = "";
          data.action = "";
          data.creation = result[0].creation;
          vals.lockSender = result[0].lockSender;

          data.senderResolved = result[0].senderResolved;
          if (data.senderResolved == null || typeof(data.senderResolved) === "undefined") {
            data.senderResolved = {}
          }

        if(utils.currentUserHasRoles([app.simaya.administrationRole], req, res)){
          data.action = "sent";
          data.status = letter.Stages.SENT;
          vals.statusProcessed = true;
            if (data.creation == "internal") {
            // skip SENT state and immediately to RECEIVED state
            data.status = letter.Stages.RECEIVED;
          }
        }else if (data.status == letter.Stages.NEW) {
            data.action = "approved";
            // if current status is new
            // then the letter status is in-review
            data.nextReviewer = data.reviewers[0];
            data.status = letter.Stages.WAITING;
          } else {
            for (var i = 0; i < data.reviewers.length; i ++) {
              if (req.session.currentUser == data.reviewers[i]) {
                if (data.reviewers[i+1]) {
                  data.nextReviewer = data.reviewers[i+1];
                  data.status = letter.Stages.WAITING;
                } else {
                  data.nextReviewer = "";
                  data.status = letter.Stages.APPROVED;
                  vals.statusApproved = true;
                }
              }
            }
          }
          vals.nextReviewer = data.nextReviewer;


          var sender = req.body.letter.sender || result[0].sender;

          letterWeb.populateReceivingOrganizations(data, null, function(ro) {
            if (data) {
              data.receivingOrganizations = ro;
            }
            cUtils.populateSenderSelection(req.session.currentUserProfile.organization, sender, vals, req, res, function(vals) {
              letterWeb.processLetterApi(vals, data, req, res);
            });
          });
          }
      });
    }
  }

  var outgoingsCancel = function(req,res){
    var search = {
      search: {}
    }

     var obj = {
            meta : { code : 200 },
    }

    search.search = {
      $or: [
        { originator: req.session.currentUser},
        { reviewers:
          { $in: [req.session.currentUser] }
        }
      ],
      status: letter.Stages.DEMOTED,
      creation: "normal",
    }

    search.page = req.query["page"] || 1;
    search.limit = parseInt(req.query["limit"]) || 20;

    letter.list( search,function(callback){
       async.parallel([
          function(cb) {
                callback.forEach(function(e, i) {
                 callback[i] = {
                    id_surat : callback[i]._id,
                    tangal_diterima : moment(callback[i].date).format("dddd, DD MMMM YYYY"),
                    nomer_surat : callback[i].mailId,
                    jenis_surat : type[callback[i].type],
                    atas_nama : callback[i].sender,
                    perihal : callback[i].title,
                    classification : callback[i].classification,
                    priority : callback[i].priority
                };
              });

              cb()
          },
          function(cb) {
            var data = callback;

            var paginations = {
              current : {
                count : data.length,
                limit : parseInt(search.limit),
                page : parseInt(search.page),
              }
            }

            obj.data = data;
            obj.paginations = paginations;

            cb()
          },
        ],
        function() {
             res.send(obj);
        });
    });
  }
 
return {
  incomings : incomings,
  incomingcount : incomingcount,
  outgoings : outgoings,
  outgoingcount : outgoingcount,
  read : read,
  sendLetter: sendLetter,

  uploadAttachment : uploadAttachment,
  deleteAttachment : deleteAttachment,
  attachments : attachments,
  attachment : attachment,
  attachmentStream : attachmentStream,

  agendaIncomings : agendaIncomings,
  agendaOutgoings : agendaOutgoings,

  senderSelection : senderSelection,
  orgSelection : orgSelection,
  recipientCandidatesSelection : recipientCandidatesSelection,
  ccCandidatesSelection : ccCandidatesSelection,
  reviewerCandidatesSelection : reviewerCandidatesSelection,
  rejectLetter : rejectLetter,
  listOutgoingDraft : listOutgoingDraft,
  createAgendaSuratIncomings : createAgendaSuratIncomings,
  cancelLetter : cancelLetter,
  rejectLetterNew:rejectLetterNew,
  processLetter : processLetter,
  outgoingsCancel:outgoingsCancel
}
}
