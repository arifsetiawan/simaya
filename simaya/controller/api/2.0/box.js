module.exports = function(app) {
	var boxC = require("../../box.js")(app);
	var utils = require("../../../../sinergis/controller/utils.js")(app);
	var notification = require("../../../models/notification.js")(app);
	var user = require("../../../../sinergis/models/user.js")(app);
	var own = require("../../../models/box")(app);
	var moment = require("moment");
	var async = require("async");
	var path = require("path");
	var url = require("url");
	var fs = require("fs");
	var azuresettings = require("../../../../azure-settings.js");
	var dbUser = app.db('user');

	var contentTypes = {
	    OWNBOX_DIR : "application/directory.ownbox"
	};

	function isSharedDir (dirname, currentUser) {
	    return dirname.indexOf("/" + currentUser + "/shared") == 0;
  	}

  	/**
	   * @api {get} api/2/box/users Find Users
	   *
	   * @apiVersion 0.1.0
	   *
	   * @apiName GetUsers
	   * @apiGroup Box
	   * @apiPermission token
	   *
	   * @apiDescription Get Users
	   * 
	   * @apiParam {String} access_token The access token
	   * 
	   * @apiExample Example usage:
	   * curl "http://simaya.cloudapp.net:3000/api/2/box/users?access_token=f3fyGRRoKZ...""
   */

 	/**
	   * @api {get} api/2/box/users/org Get user organization
	   *
	   * @apiVersion 0.1.0
	   *
	   * @apiName GetUsersOrg
	   * @apiGroup Box
	   * @apiPermission token
	   *
	   * @apiDescription Get User Organization
	   * 
	   * @apiParam {String} access_token The access token
	   *
   	*/

   	/**
	   * @api {get} api/2/box/dir Get Directory Name
	   * @api {get} api/2/box/dir/* Get Directory Name
	   *
	   * @apiVersion 0.1.0
	   *
	   * @apiName Get Directory Name
	   * @apiGroup Box
	   * @apiPermission token
	   *
	   * @apiDescription Get Directory Name
	   * 
	   * @apiParam {String} access_token The access token
	   *
	   * @apiExample URL Structure:
	   * // DEVELOPMENT
	   * http://simaya.cloudapp.net:3000/api/2/box/dir
	   * http://simaya.cloudapp.net:3000/api/2/box/dir/*
	   * 
   */
	var readDir = function (req, res) {
	
	    var currentPath = req.path.substr("/api/2/box/dir/".length, req.path.length) || req.session.currentUser;
 	
	    currentPath = "/" + currentPath;
	 
	    var shared = isSharedDir(currentPath, req.session.currentUser);

	    // if(req.accepted && req.accepted.length > 0 && req.accepted[0].value != "application/json") {
	    //   // console.log("test req.accepted");
	    //   return renderIndex(req, res, { isPersonal : !shared, currentPath : currentPath });
	    // }

	    var box = own.box(req.session);

	    function packedItems(result){
	      var items = []

	      for (var item in result) {
	        
	        result[item].name = item;

	        var revisions = result[item].revisions;

	        if (revisions && revisions.length > 0) {
	          
	          var revision = revisions[ revisions.length - 1];
	          var metadata = revision.metadata || {};

	          result[item].type = revision.contentType;
	          result[item].isDir = revision.contentType == contentTypes.OWNBOX_DIR;
	          result[item].name = revision.metadata.basename;
	          result[item].dirname = revision.metadata.dirname;
	          result[item].date = moment(revision.uploadDate).fromNow();
	          result[item].revisions = revisions.length;
	          result[item].owner = revision.metadata.owner;
	          result[item].fullDate = revision.uploadDate;
	          result[item].sharedTo = revision.metadata.sharedTo || [];
	          // result[item].latest = revision;
	        }

	        items.unshift(result[item]);
	      } 

	      return items;
	    }

	    if (shared) {
	      box.shared(function(err, result){
	        var items = packedItems(result);
	        res.send(200, { items : items, currentPath : currentPath });
	      });
	    } else {
		    box.directory(currentPath).items(function(err, result){
		        if (err) {
		          return res.send(404, {});
		        } else {
		          var items = packedItems(result);
		          // console.log(items);
		          res.send(200, { items : items, currentPath : currentPath });
		        }
		    });  
	    }
	}

  /**
   * @api {get} api/2/box/file/* Read Files
   *
   * @apiVersion 0.1.0
   *
   * @apiName Get File Names
   * @apiGroup Box
   * @apiPermission token
   *
   * @apiDescription Get name files
   * 
   * @apiParam {String} access_token The access token
   *
   */

	var readFile = function (req, res) {
	    var u = url.parse(req.url);
	    var item = u.pathname.substr("/api/2/box/file".length, u.pathname.length);
	    item = decodeURI(item);
	    var box = own.box(req.session);
	    var filename = path.basename(item);
	    // console.log(u, item, box, filename);
	    res.setHeader("Content-Disposition", 'attachment;filename="' + filename + '"');

	    var dirname = path.dirname(item);
	    var parts = dirname.split("/");
	    if (parts.length > 1) {
	      var ownerUser = parts[1];

	      // if the owner of the file is different
	      if (ownerUser != box.owner.user) {
	        // the profile is not important for reading
	        box = own.box({ currentUser : ownerUser, currentUserProfile : {}});
	      }
	    } 

	    // download from the right path
	    box.directory(path.dirname(item)).file(filename).read({ to : res }, function(err){
	      if (err) {
	        res.redirect("/box/dir/" + path.dirname(item));
	      }
	    });
  	}

  	/**
	   * @api {post} api/2/box/file Write File
	   *
	   * @apiVersion 0.1.0
	   *
	   * @apiName PostWriteFile
	   * @apiGroup Box
	   * @apiPermission token
	   *
	   * @apiDescription Post File to Database
	   * 
	   * @apiParam {String} access_token The access token
	   *
	   * 
	   * @apiExample Example usage:
	   * curl "http://simaya.cloudapp.net:3000/api/2/box/file?access_token=f3fyGRRoKZ..." -F "files=@C:/lokasi/file/yang/dituju" -F "dirname=berkas"
	*/

  	var writeFile = function (req, res) {
  		 var obj = {
                  meta : { code : "200" },
                  data : {}
                }

         var uploaded = req.files.files;
	     var dirname = req.body.dirname;
         if(uploaded && dirname){
         	var box = own.box(req.session);
		    var source = fs.createReadStream(uploaded.path);

		    process.nextTick(function(){

		      box.directory(dirname).stream(uploaded.originalFilename, {_stream : source}).write(function(err, result){
		        fs.unlink(uploaded.path, function(){
		          obj.data.success = true;
		          obj.data.info = result;
		          res.send(obj);
		        });
		      });

		    });
         }else{
         	  obj.data.success = false;
	          obj.data.info = "Files and Dirname is required";
	          res.send(obj);
         }
		
  	}

  	/**
	   * @api {post} api/2/box/dir Create Directory
	   *
	   * @apiVersion 0.1.0
	   *
	   * @apiName CreateDirectory
	   * @apiGroup Box
	   * @apiPermission token
	   *
	   * @apiDescription Create Directory
	   * 
	   * @apiParam {String} access_token The access token
	   *
	   * 
	   * @apiExample Example usage:
	   * curl "http://simaya.cloudapp.net:3000/api/2/box/dir?access_token=f3fyGRRoKZ..." -F "path=simaya"
	*/
    var createDir = function (req, res) {
	  	var obj = {
	                  meta : { code : "200" },
	                  data : {}
                  }

	    var dirname = req.body.path;

	    if(dirname && dirname!=="shared"){
    	 	if (isSharedDir(dirname, req.session.currentUser)) {
    	   		obj.data.success = false;
		      	obj.data.info = "shared is reserved";
		      	res.send(obj);
		    }

		    var boxC = own.box(req.session);

		    boxC.directory(dirname).create(function(err, result){
		      if (err) {
		      	obj.data.success = false;
		      	obj.data.info = err
		      }else{
		      	obj.data.success = true;
		      	obj.data.path = dirname;
		      	obj.data.info = result;
		      } 
		      res.send(obj);
		    });
	    }else{ 
			obj.data.success = false;
	      	obj.data.info = "Path is required/Name path tidak boleh shared";
	      	res.send(obj);
	    }
	 
	}

	
	var revisions = function (req, res) {
    var u = url.parse(req.url);
    console.log(req.url);
    var item = u.pathname.substr("/api/2/box/file".length, u.pathname.length);
    var box = own.box(req.session);

    box.directory(path.dirname(item)).file(filename).revisions(function(err, result){
      if (err) {
        res.redirect("/api/2/box/dir/" + path.dirname(item));
      } else {
        res.send({ revisions : result});
      }
    });
  }

  	/**
	   * @api {post} api/2/box/share/file Share File
	   *
	   * @apiVersion 0.1.0
	   *
	   * @apiName ShareFile
	   * @apiGroup Box
	   * @apiPermission token
	   *
	   * @apiDescription Share file to another users
	   * 
	   * @apiParam {String} access_token The access token.
	   * @apiParam {String} currentPath  Path want to share.
	   * @apiParam {String} users Users would be share.
	   * @apiParam {String} item  Item name wante to share (Example ic_drawer.png).
	   * @apiParam {String} itemType  Item type want to share (Example image/png).
	   * @apiParam {String} message  Message to users.
	*/	
   var shareFile = function (req, res) {

    var body = req.body;
    var box = own.box(req.session);
    var names = body.users.split(",");

    var obj = {
	              meta : { code : "200" },
	              data : {}
	          }

    if(req.body.currentPath && req.body.users && req.body.item && req.body.itemType && req.body.message){
	      function getUserProfile(usr, cb){
	      // list user
	      user.list({ search : { "username" : usr } }, function(result){
	        if (result && result.length > 0) {
	          cb(null, {
	            user : result[0].username,
	            profile : result[0].profile
	          });
	        } else {
	          return cb(null, { user : usr, profile : {} });
	        }
	      });
	    }

	    // get user objects [{ user : user, profile : profile}]
	    async.map(names, getUserProfile, function(err, users){

	      if (err){
			obj.data.success = false;
			obj.data.info = err;
			res.send(obj);
	      }else{
	      	box.directory(body.currentPath).file(body.item).share({ to : users }, function(err, updated){
	          
	          if (err) {
	           	obj.data.success = false;
				obj.data.info = err;
				res.send(obj);
	          }else{
	          	 if (updated && updated.length > 0) {
		            var sender = req.session.currentUserProfile ? (req.session.currentUserProfile.fullName || req.session.currentUser) : req.session.currentUser;
		            var message =  "Telah membagikan " + body.item;
		            message += body.message ? (" Pesan: " + body.message) : "";
		            
		            for (var i = 0; i < users.length; i++) {
		              //azuresettings.makeNotification(message, req.session.currentUserProfile.id);
		              dbUser.findOne({username:  users[i].user}, function(error, resultUser){
				        if(!error){
		             		azuresettings.makeNotificationWindows(sender+" "+message,resultUser._id);
		             		notification.set(sender, resultUser.username, message, "/box/dir/" + resultUser.username + "/shared");
				        }
				      });
		            }
		          }
		         	obj.data.success = true;
					res.send(obj);
	          }
	        });  
	      }
	    });
    }else{
    	obj.data.success = false;
		obj.data.info = "currentPath/Users/Item/Item Type/Message required";
		res.send(obj);
    }
    
  }

	/**
		* @api {post} api/2/box/share/file Share Directory
		*
		* @apiVersion 0.1.0
		*
		* @apiName ShareDirectory
		* @apiGroup Box
		* @apiPermission token
		*
		* @apiDescription Share file to another users
		* 
		* @apiParam {String} access_token The access token.
		* @apiParam {String} pathShare  Path want to share.
		* @apiParam {String} users Users would be share (Example faerul,dycode).
	*/	
  var shareDir = function (req, res) {
     var obj = {
	              meta : { code : "200" },
	              data : {}
	           }

    if(req.body.pathShare && req.body.users){
		var body = req.body;
	    var box = own.box(req.session);
	    var users = body.users.split(",");

	    function getUserProfile(usr, cb){
	      // list user
	      user.list({ search : { "username" : usr } }, function(result){
	        if (result && result.length > 0) {
	          cb(null, {
	            user : result[0].username,
	            profile : result[0].profile
	          });
	        } else {
	          return cb(null, { user : usr, profile : {} });
	        }
	      });
	    }

	    async.map(users, getUserProfile, function(err, result) {
	      if (err){
	      		obj.data.success = false;
				obj.data.info = err;
				res.send(obj);
	      } else{
			// get all items inside dirs
			box.directory(body.pathShare).share({to : result}, function(err, updated){
				if(!err){
					obj.data.success = true;
					res.send(obj);
				}else{
					obj.data.success = false;
					obj.data.info = err;
					res.send(obj);
				}
			});
	      }
	    });
    }else{
    	obj.data.success = false;
		obj.data.info = "Pathshare/Users required";
		res.send(obj);
    }
  }

  	/**
		* @api {post} api/2/box/delete/file Delete File
		*
		* @apiVersion 0.1.0
		*
		* @apiName DeleteFile
		* @apiGroup Box
		* @apiPermission token
		*
		* @apiDescription Delete file
		* 
		* @apiParam {String} access_token The access token.
		* @apiParam {String} currentPath  Location directory file want to delete.
		* @apiParam {String} item Name file want to delete.
	*/	
   var deleteFile = function (req, res) {
   	 var obj = {
	              meta : { code : "200" },
	              data : {}
	           }

	var body = req.body;    

	if(body.currentPath && body.item){
	    var box = own.box(req.session);
	    box.directory(body.currentPath).file(body.item).destroy(function(err) {
	      if (err){
	      	obj.data.success = false;
			obj.data.info =  err;
			res.send(obj);
	      }else{
	      	obj.data.success = true;
			res.send(obj);
	      }
	    });
	}else{
		obj.data.success = false;
		obj.data.info = "currentPath/Item required";
		res.send(obj);
	}      
   
  }

  /**
	* @api {post} api/2/box/delete/dir Delete Directory
	*
	* @apiVersion 0.1.0
	*
	* @apiName DeleteDirectory
	* @apiGroup Box
	* @apiPermission token
	*
	* @apiDescription Delete directory
	* 
	* @apiParam {String} access_token The access token.
	* @apiParam {String} currentPath  Directory name want to delete.
  */	
  var deleteDir = function (req, res) {
  	var obj = {
	              meta : { code : "200" },
	              data : {}
	           }

	var body = req.body;

	if(body.currentPath){
	    var box = own.box(req.session);
	    box.directory(body.currentPath).destroy(function(err){
	      if (err){
	      	obj.data.success = false;
			obj.data.info =  err;
			res.send(obj);
	      }else{
	      	obj.data.success = true;
			res.send(obj);
		   }
	    });
	}else{
		obj.data.success = false;
		obj.data.info = "currentPath required";
		res.send(obj);
	}
   
  }

	return {
		readDir : readDir,
		readFile : readFile,
		writeFile : writeFile,
		createDir : createDir,
		revisions : revisions,
		shareFile : shareFile,
		shareDir : shareDir,
		deleteFile : deleteFile,
		deleteDir : deleteDir
	}
}