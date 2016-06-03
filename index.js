//var cool = require('cool-ascii-faces');
var express = require('express');
var app = express();
var port = process.env.PORT || 8080;
/* To support login with facebook */
//var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var fb = require('connect-ensure-login');
var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy;

/* To support the database */
var pg = require('pg'); 

var http = require('http');

const crypto = require('crypto');

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));

var connectionString = process.env.DATABASE_URL;
var client = new pg.Client(connectionString);

// Configure the Facebook strategy for use by Passport.
//
// OAuth 2.0-based strategies require a `verify` function which receives the
// credential (`accessToken`) for accessing the Facebook API on the user's
// behalf, along with the user's profile.  The function must invoke `cb`
// with a user object, which will be set at `req.user` in route handlers after
// authentication.
passport.use(new FacebookStrategy({
		clientID: 874576735997925, //process.env.CLIENT_ID,
		clientSecret: '0e8803d67c827a86c9f4cb470c79f8ed', //process.env.CLIENT_SECRET,
		callbackURL: 'https://nwen304group6.herokuapp.com/login/facebook/return'
	},
	function(accessToken, refreshToken, profile, cb) {
		// In this example, the user's Facebook profile is supplied as the user
		// record.  In a production-quality application, the Facebook profile should
		// be associated with a user record in the application's database, which
		// allows for account linking and authentication with other identity
		// providers.
		return cb(null, profile);
	}
));

/* https://scotch.io/tutorials/easy-node-authentication-setup-and-local  */
passport.use(new LocalStrategy({
		usernameField: 'username',
		passwordField: 'password',		
	},

	function(username, password, done){

		console.log('LocalStrategy: username: ' + username + '. password: ' + password);

		pg.connect(connectionString, function (err, client, completed){
			if(err){
					console.log('Could not connect to postgresql on signup',err);
					return;
			}
			client.query("select password from members where username = '" + username + "';", function(error, result){
				completed();
				if(error){
					console.log('error', error);
				}
				console.log('function in passport.use(new LocalStrategy');
				if(result.rows[0] != undefined){ // check for the case where no match is found in the table.
					console.log(result.rows[0].password);

					const hash1 = crypto.createHash('sha256');
					hash1.update(password);
					var passwordHash = hash1.digest('hex');

					if(passwordHash == result.rows[0].password){
						console.log('successful login 2, username:' + username);
						/*
						var newUser = new User();
						newUser.local.displayName = 'bob';
						newUser.save(function(err){
							if (err)
								throw err;
							return done(null, newUser);
						});
						*/
						return done(null, username);
						//res.redirect('/login');
					} else {
						console.log('unsuccessful login');
						return done(null, false, {message: "Message: unsuccessful login"});
						//res.redirect('/login');
					}
				}
				else {	// No match in the table
					console.log('  email not found in database');
					return done(null, false, {message: "Message: email not found in database"});
					//res.redirect('/login');
				}
				client.end();
			});	
		});	
	}
));



// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));



/* Redirect http to https */
app.get('*',function(req,res,next){
  if(req.headers['x-forwarded-proto']!='https'&&process.env.NODE_ENV === 'production')
    res.redirect('https://'+req.hostname+req.url)
  else
    next() /* Continue to other routes if we're not redirecting */
});
// response time for API functions
app.all('*', function(req, res, next) {
  var start = process.hrtime();

  // event triggers when express is done sending response
  res.on('finish', function() {
    var hrtime = process.hrtime(start);
    var elapsed = parseFloat(hrtime[0] + (hrtime[1] / 1000000).toFixed(3), 10);
    console.log(elapsed + 'ms');
  });

  next();
});


var urlencodedparser = require('body-parser').urlencoded({extended: false});

// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  In a
// production-quality application, this would typically be as simple as
// supplying the user ID when serializing, and querying the user record by ID
// from the database when deserializing.  However, due to the fact that this
// example does not have a database, the complete Twitter profile is serialized
// and deserialized.
passport.serializeUser(function(user, cb) {
	console.log('serializeUser');
	cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
	console.log('deserializeUser');
	cb(null, obj);
});

app.set('port', process.env.PORT);

app.use(express.static(__dirname + '/public'));

app.set('view engine', 'ejs');

// Initialize Passport and restore authentication state, if any, from the session.
app.use(passport.initialize());
app.use(passport.session());


app.get('/', function(req,res){
	res.render('pages/home',{user: req.user});
});


app.get('/login',
	function(req, res){
		res.render('pages/login');
	});

app.post('/loginnew', loginPost);

/* Login without facebook */
function loginPost(req, res, next) {
	console.log('index.js loginPost');
  	// Ask passport to authenticate.
  	/* Local authentication. That is, authentication without Facebook */
  	passport.authenticate('local', function(err, username, info) {
  		console.log('loginPost passport.auth');
    	if (err) {
      	// if error happens
      	console.log('loginPost err');
      	return next(err);
    	}    
    	if (!username) {
      	// If authentication fails, get the error message that we set
      	// from previous (info.message) step, assign it into to
      	// req.session and redirect to the login page again to display
      	req.session.messages = info.message;
      	console.log('loginPost !username');
      	return res.redirect('/login');
    }
    // If everything's OK
    req.logIn(username, function(err) {
      	if (err) {
        	req.session.messages = "Error";
        	console.log('loginPost Error');
        	return next(err);
      	}
      	// Set the message
      	req.session.messages = "Login successfully";

      	/* Set the displayName */
      	var nu = { displayName : username };
      	req.session.passport.user = nu;

      	console.log('loginPost successful');
      	return res.redirect('/index');
    });    
  })(req, res, next);
}


app.get('/login/facebook', passport.authenticate('facebook'));


app.get('/login/facebook/return', passport.authenticate('facebook', { failureRedirect: '/login' }), authenticateCallBack);

/* Facebook authentication */
function authenticateCallBack(req, res) {

	console.log('index.js authenticateCallBack');
	var u = req.user;
				
	/* Now connect to heroku members table to check if facebook user already exits in database. */
	pg.connect(connectionString, connectCallBack);

	function connectCallBack(err2, client2){
	console.log('index.js connectCallBack');
	if(err2){
		console.log('Could not connect to postgresql on signup',err2);
		return;
	}

	client2.query("select * from members where username = '" + u.displayName + "';", callBack2);

	function callBack2(error2, result2){
		console.log('index.js callBack2');
		if(error2){
			console.log('error', error2);
		}
			
		if(result2.rows[0] != undefined){ // check for the case where no match is found in the table.
			console.log('index.js ' + result2.rows[0].username + ' - Found in members table.');	
		} //else add to members
		else {
			console.log('          Insert new facebook user into members table');
			insertNewFacebookUserIntoMembers(u);
		}
		client2.end();
	}
}

	res.redirect('/index');
}

function insertNewFacebookUserIntoMembers(u){
	console.log('index.js insertNewFacebookUserIntoMembers');
	pg.connect(connectionString, function (err3, client3){
		if(err3){
			console.log('Could not connect to postgresql on signup',err3);
			return;
		}			
		/* Put facebook user details into members table */
		//client3.query("insert into members values (default, '" + u.displayName + "','','','" + u.id + "');", insertCallback);
		client3.query("insert into members values (default, '" + u.displayName + "','','','" + u.id + "');", insertCallback);
		function insertCallback(error3, result3){
			console.log('index.js insertCallback');
			if(error3){
				console.log('error3', error3);
			}
			client3.end();	
		}
	});
}



app.get('/login/local',
	function(req,res){
		console.log('/login/local ----------------------------------')
		res.render('pages/local');
});

app.get('/signup',
	function(req,res){
		res.render('pages/signup');
});


app.get('/index',
	require('connect-ensure-login').ensureLoggedIn(),
	function(req, res){
		res.render('pages/index', { user: req.user });
	});

/*
app.get('/indexWithoutFacebook',
	require('connect-ensure-login').ensureLoggedIn(),
	function(req, res){
		console.log('/indexWithoutFacebook');
		//req.user.displayName = 'Fred';
		res.render('pages/index', { user: req.user });
	}); */


app.get('/logout/facebook', fb.ensureLoggedIn(),
	function(req, res){
		req.logout();
		res.redirect('/');
});

app.get('/goShopping',
	require('connect-ensure-login').ensureLoggedIn(),
	function(req, res){
			//HTTP CACHE HEADERS
		res.setHeader('Cache-Control', 'public, max-age=3');
		res.render('pages/shopping', { user: req.user });
	});



app.get('/profile',
	require('connect-ensure-login').ensureLoggedIn(),
	function(req, res){

		res.render('pages/profile', { user: req.user });
});

app.get('/db', function(req, res){
	pg.connect(process.env.DATABASE_URL, function(err, client, done){
		if(err){
			console.error('Could not connect to the database');
			console.error(err);
			return;
		}
		var query = client.query("SELECT * FROM people;", function(error, result){
				done();
				if(error){
				}
		});
		var results = [];
			// Stream results back one row at a time
			query.on('row',function(row){
				results.push(row);
			});
			// After all data is returned, close connection and return results
			query.on('end',function(){
				client.end();
				//HTTP CACHE HEADERS
				res.setHeader('Cache-Control', 'public, max-age=3');
				res.json(results);
			});
		});
});

//Gets all the data from a members shopping cart
app.get('/cart', function(req, res){
	pg.connect(process.env.DATABASE_URL, function(err, client, done){
		if(err){
			console.error('Could not connect to database');
			console.error(err);
			return;
		}
		//var memberid = req.body.member;
		//var query =  client.query("SELECT i.Name, i.Price, s.Quantity FROM ShoppingCart s INNER JOIN Items i ON s.itemid = i.itemid WHERE memberid = '"+ memberid +"';",
		var query = client.query("SELECT i.Name, i.Price, s.Quantity FROM ShoppingCart s INNER JOIN Items i ON s.itemid = i.itemid WHERE memberid = 8;",
		function(error, result){
			if(err){
				console.error(error);
				return;
			}
			done();
		});
		var results = [];
		// Stream results back one row at a time
		query.on('row', function(row){
			results.push(row);
		});
		// After all data is returned, close connection and return results
		query.on('end', function(){
			client.end();
			//HTTP CACHE HEADERS
			//res.setHeader('Cache-Control', 'public, max-age=3');
			res.json(results);
		});
	});
});

//Gets all the items for the store
app.get('/store', function(req, res){
	pg.connect(process.env.DATABASE_URL, function(err, client, done){
		if(err){
			console.error('Could not connect to database');
			console.error(err);
			return;
		}
		var query =  client.query("SELECT * FROM Items;", function(error, result){
			if(error){
				console.error(error);
				return;
			}
			done();
		});
		var results = [];
		// Stream results back one row at a time
		query.on('row', function(row){
			results.push(row);
		});
		// After all data is returned, close connection and return results
		query.on('end', function(){
			client.end();
			//HTTP CACHE HEADERS
			res.setHeader('Cache-Control', 'public, max-age=3');
			res.json(results);
		});
	});
});

//Adds items to a members shopping cart
app.post('/cart/add', function(req, res){
	pg.connect(process.env.DATABASE_URL, function(err, client, done){
		var memberid = req.body.member; 
		var itemid = req.body.item;
		var query = client.query("WITH upsert AS (UPDATE ShoppingCart SET Quantity = Quantity + 1 WHERE memberid = '"+memberid+"' AND itemid = '"+itemid+"' RETURNING *) INSERT INTO ShoppingCart (memberid,itemid,Quantity) SELECT '"+memberid+"','"+itemid+"',1  WHERE NOT EXISTS (SELECT * FROM upsert);");

		//Error checking for adding to shopping cart
		query.on('error',function(){
			return response.status(500).send('Error updating shopping cart');
		});
		res.send("Item has been added to cart \n");
	});
});

//Deletes items to a members shopping cart
app.delete('/cart/delete', function(req, res){
	pg.connect(process.env.DATABASE_URL, function(err, client, done){
		var memberid = req.body.member; 
		var itemName = req.body.name; 
		//var query = client.query("DELETE FROM ShoppingCart WHERE memberid = '"+memberid+"' AND itemname = '"+itemName+"';");
		var query = client.query("DELETE FROM ShoppingCart WHERE memberid = 8 AND itemname = '"+itemName+"';");

		//Error checking for deleting from shopping cart
		query.on('error',function(){
			return res.status(500).send('Error deleting from shopping cart');
		});
		res.send("Item has been deleted from cart \n");
	});
});

//Adds purchases when a user buys items
app.put('/cart/purchase', function(req, res){
	pg.connect(process.env.DATABASE_URL, function(err, client, done){
		var memberid = 8//req.body.member;
		var itemid = 1//req.body.item;
		var price = 20.35//req.body.price;

		var query = client.query("INSERT INTO Purchases (MemberID,ItemID,Price,DatePurchased) VALUES('"+memberid+"','"+itemid+"','"+price+"',CURRENT_DATE);");

		//Error checking for adding to purchases
		query.on('error', function(){
			return response.status(500).send('Error adding to purchases');
		});
		res.send("Purchase has been made \n");
	});
});


/* Currently inputs data into members table in db and then returns to /login page. */
app.post('/signup', urlencodedparser, function(req,res){
		console.log('here, signing up');
		var username = req.body.username;
		var email = req.body.email;
		var password = req.body.password;
		console.log('username: ' + username);

		console.log('email: ' + email);
		console.log('password: ' + password);

		pg.connect(connectionString, function (err, client, done){
			console.log('pg.connect...............................');
			if(err){
					console.log('Could not connect to postgresql on signup',err);
					return;
			}
			const hash = crypto.createHash('sha256');
			hash.update(password);
			var encrypted = hash.digest('hex');
			var query = client.query("insert into members values (default,'" + username + 
				"','" + encrypted + "','" + email + "', null);", function(error, result){
					done();
					if(error){}
						res.redirect('/login');
				});
		 });
}); 

/*
//https://scotch.io/tutorials/easy-node-authentication-setup-and-local
app.post('/Locallogin', passport.authenticate('local-login', {

        successRedirect : '/indexWithoutFacebook', // redirect to the secure profile section
        failureRedirect : '/login', // redirect back to the signup page if there is an error
        failureFlash : true // allow flash messages
	})
	
); */

app.listen(port, function() {
	console.log('Node app is running on port: '+port);
});