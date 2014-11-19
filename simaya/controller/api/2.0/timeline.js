module.exports = function(app) {
	var timeline = require("../../timeline.js")(app)
	  , timelineM = require("../../../models/timeline.js")(app)
	  , contactM = require("../../../models/contacts.js")(app)
	  , ObjectID = app.ObjectID
	  , settingdb = require("../../../../settings.js")
	  , moment = require("moment")
	  , ob = require("../../../../ob/file.js")(app);

	var dbContactsCache = app.db('contacts_cache');
	var dbTimeline = app.db('timeline');

  /**
   * @api {get} /timeline/list View timeline
   *
   * @apiVersion 0.1.0
   *
   * @apiName ViewTimeline
   * @apiGroup Timeline
   * @apiPermission token
   *
   * @apiDescription Gets timeline posts of current user
   * 
   * @apiParam {String} access_token The access token
   * @apiParam {String} page The <code>page-th</code> of result group
   * @apiParam {String} limit The maximum number of letters per page
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://simaya.cloudapp.net/api/2/timeline/list
   * 
   * @apiExample Example usage:
   * curl http://simaya.cloudapp.net/api/2/timeline/list?access_token=f3fyGRRoKZ...
   */

	var listJSON = function(req, res) {
		var data = cari = {};
		var meta = 0;
		var username = req.user.id;
		var lovesTemp = userArray = friends = [];
		var attTemp = "";

		// default page and limit values
		var page = 1;
		var limit = 10;
		if (req.user.id) {
			if (req.query.page && req.query.limit) {
				page = req.query.page;
				limit = req.query.limit;
			}
			var skip = page > 0 ? ((page - 1) * limit) : 0;

			//var collectionConn = settingdb.db.collection("contacts_cache");
			dbContactsCache.distinct('end2', {end1:req.user.id}, function(err, docs) {
				friends = docs;
				friends.push(req.user.id);
				// console.log(friends); 

				var search = [];

				for (var i = 0; i < friends.length; i++) {
					search.push({"user":friends[i]});
				}
				// console.log(search) 

				cari = {
					$or : search
				}
				console.log(cari);

				//var collection = settingdb.db.collection("timeline");
				dbTimeline.find(cari, {skip: skip, limit: limit}, function(err, cursor) {
					cursor.sort({date:-1}).toArray(function(err, result) {
						
							for (var i = 0; i < result.length; i++) {
							 if(result[i].comments){
							 	for(index in result[i].comments){
							 		result[i].comments[index].time = moment(result[i].comments[index].date).fromNow();
							 	}
							 	
							 }


							// ganti isi loves dengan lovesTemp
							if (result[i].loves) {
								lovesTemp = [];
								userArray = Object.keys(result[i].loves);
								for(var j = 0; j < userArray.length; j++) {
									lovesTemp.push(result[i]["loves"][userArray[j]]);
								}
							}
							if (lovesTemp.length != 0) {
								result[i].loves = lovesTemp;
							}
							/*if (result[i].attachment) {
								attTemp = "/api/2" + result[i].attachment;
								console.log(attTemp);
								result[i].attachment = attTemp;
							}*/
						}
						if (err) {
							data.meta = meta = 500;
							data.error = err;
						}else {
							data.meta = meta = 200;
							data.result = result;
						}
						res.json(meta, data);
					});
				});
			});
		}
	}

	/*var postTimeline = function(req, res) {
		if (req.body.text) {
			var data = {
				date : new Date(),
				text : req.body.text,
				user : req.session.currentUser,
			}
			if (req.body.attachment) {
				data.attachment = req.body.attachment
			}
			timelineM.insert(data, function(err, id) {
				app.io.updateTimeline({
					me : req.session.currentUser,
					id : id,
				});
				res.send({
					ok : true,
					id : id
				});
			});
		}else {
			res.send({ok: false});
		}
	}*/

	var postComment = function(req, res) {
		if (req.body.id && req.body.text) {
		     var obj = {
		      meta : { code : 200 },
		      data : { }
		    }

		  var data = {
		    date: new Date(),
		    id: req.body.id,
		    user: req.session.currentUser,
		    text: req.body.text,
		  }
		  timelineM.comment(data, function(result) {
		    if (result) {
		      app.io.updateTimeline({
		        me: req.session.currentUser,
		        id: req.body.id,
		      }); 
		      obj.data.comments = {
		      	date: new Date(),
			    user: req.session.currentUser,
			    text: req.body.text,
	        	time : "beberapa detik yang lalu"
		      }
		      obj.data.success = true; 
		      res.send(obj);
		    } else {
		      obj.data.success = false; 
		      res.send(obj);
		    }
		  });
		} else {
		  obj.data.success = false; 
		  res.send(obj);
		}
	}

	 var love = function(req, res) {
	    if (req.body.id) {
    	  var obj = {
		    meta : { code : 200 },
		    data : {}
	      }

	      var data = {
	        date: new Date(),
	        id: req.body.id,
	        user: req.session.currentUser,
	      }
	      timelineM.love(data, function(result) {
	        if (result) {
	          app.io.updateTimeline({
	            me: req.session.currentUser,
	            id: req.body.id,
	          }); 
	          obj.data.success = true; 
	          res.send(obj);
	        } else {
	          obj.data.success = false; 
	          res.send(obj);
	        }
	      });
	    } else {
	      obj.data.success = false; 
	      res.send(obj);
	    }
	}

	var unlove = function(req, res) {
	    if (req.body.id) {
		  var obj = {
			  meta : { code : 200 },
			  data : {}
		   }

	      var data = {
	        date: new Date(),
	        id: req.body.id,
	        user: req.session.currentUser,
	      }
	      timelineM.unlove(data, function(result) {
	        if (result) {
	          app.io.updateTimeline({
	            me: req.session.currentUser,
	            id: req.body.id,
	          }); 
	          obj.data.success = true; 
	          res.send(obj);
	        } else {
	          obj.data.success = false; 
	          res.send(obj);
	        }
	      });
	    } else {
	      obj.data.success = false; 
	      res.send(obj);
	    }
	}

	var uploadMedia = function(req, res) {
	    ob.simplePublicUpload(req.files.upload, "/timeline/status", function(e, r) {
	      var image = "/ob/get/" + r._id;
	      console.log({path : image});
	      res.send({path: image})
	    });
  	}

	return {
		listJSON: listJSON,
		uploadMedia : uploadMedia,
		postComment : postComment,
		love : love,
		unlove : unlove
	}
};