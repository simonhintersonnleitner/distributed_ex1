/*
 @Authors:
 Simon Hintersonnleitner
 Fabin Hoffmann
*/

var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http, {path: '/public/socket.io'})
var _ = require('underscore');

//express
app.use(express.static(__dirname + '/public'));
app.get('/', function(req, res){
  res.sendFile(__dirname + '/client.html');
});

var userList = [];
var articleList = [];
var auctionList = [];

//User model
var UserModel = function(user, pw) {
  this._userName = user;
  this._pwd = pw;
  this.socket;

  this.logout = function(){
    this.socket = '';
  };

  this.delete = function() {
    io.sockets.connected[this.socket].emit('delete_result');
    userList = _.without(userList, _.findWhere(userList, {_userName: this._userName}));
  };

  userList.push(this);
}

UserModel.prototype = {
  findUser: function(user) {
    return _.find(userList, function(u){return u._userName === user});
  },
  getPwd: function() {
    return this._pwd;
  }
}

//article model
var ArticleModel = function(name, description, price) {
  if(articleList.length > 0) {
    this._id = articleList[articleList.length - 1]._id + 1;
  }
  else {
    this._id = 0;
  }

  this._name = name;
  this._description = description;
  this._regularPrice = price;
  articleList.push(this);
}
ArticleModel.prototype = {
  getArticleById: function(id) {
    return _.findWhere(articleList, {_id: id});
  }
}

//AuctionModel
var AuctionModel = function(articleId, beganAt, endsAt) {
    if(auctionList.length > 0) {
    this._id = auctionList[auctionList.length - 1]._id + 1;
  }
  else {
    this._id = 0;
  }

  this._article = ArticleModel.prototype.getArticleById(articleId);
  this._beganAt = beganAt;
  this._endsAt = endsAt;
  this._bids = [];
  this._ended = false;

  this.endAuction = function(){
    this._ended = true;
    io.emit('auction_ended', this._id);
    this.notifyWinner();
  };

  this.notifyWinner = function(){
    var winningBid = AuctionModel.prototype.getWinningBid(this);
      //is there a winningBid with a user?
    if(winningBid._user) {
      //if the user connected?
      if(io.sockets.connected[winningBid._user.socket]){
        io.sockets.connected[winningBid._user.socket].emit('win_result', this._id);
      }
      else{
        //User not connected
      }
    }
    else { //Restart auction
      var auction = new AuctionModel(this._article._id, Date.now(), Date.now() + 1000 * 60 * 1);
      io.emit('new_auction', auction);
    }
  };

  auctionList.push(this);
}

AuctionModel.prototype = {
  getLiveAuctions: function() {
    return _.filter(auctionList, function(auc){ return !auc._enden && auc._endsAt > Date.now(); });
  },
  getAuction: function(auctionId) {
    return _.find(auctionList, function(a){return a._id === auctionId});
  },
  newBid: function(auctionId, value, username) {
    var auction = AuctionModel.prototype.getAuction(auctionId);

    if(!auction._ended || value > 0 || !isNaN(parseFloat(value)) ){
      var bid = new BidModel(value, username);
      auction._bids.push(bid);

      //check how many bids have same value
      var count = _.filter(auction._bids, function(b) {
        return b._value === bid._value;
      }).length;
      //if 1
      if (count === 1) {
        var winningBid = AuctionModel.prototype.getWinningBid(auction);
        //if user owns this bid
        if(winningBid._value === bid._value){
          return -1;
        }
      }
      //return amount of bids with this value
      return count;
    }
    //error
    return -2;
  },
  getWinningBid: function(auction) {
    var sortedBids = _.sortBy(auction._bids, function(b){
      return b._value;
    });

    var winningBid = false;

    //iterate over all bids and find lowest single bid
    for (var i = 0; i < sortedBids.length; i++) {

      var amount = _.filter(sortedBids, function(b){
        return b._value === sortedBids[i]._value;
      }).length;

      if ( amount === 1 ) {
        //winning bid found
        winningBid = sortedBids[i];
        break;

      }
    }
    return winningBid;
  },
  checkBid: function(username, auctionId) {
    var user = UserModel.prototype.findUser(username);
    var auction = AuctionModel.prototype.getAuction(auctionId);
    var winningBid = AuctionModel.prototype.getWinningBid(auction);

    //check if user has placed bids
    if (!_.find(auction._bids, function(b){ return b._user === user}))
      return -1; //no bid placed

    //if user own winningBid
    if(winningBid._user === user)
      return 1;//won

    return 0;//lost
  },
  //check if auctions have ended
  checkForEndedAuctions: function() {
    for (var i = 0; i < auctionList.length; i++) {
      var ends = auctionList[i]._endsAt;
      var now = Date.now();

      // end this auction
      if(now >= ends && !auctionList[i]._ended) {
        auctionList[i].endAuction();
      }
    }
  }
}

var BidModel = function(value, username) {
  this._user = UserModel.prototype.findUser(username);
  this._value = value * 1;
}

function authenticate(username, pw) {
  var user = UserModel.prototype.findUser(username);
  if (user === undefined || user.getPwd() !== pw)
    return false;
  return true;
}

//socket functions
io.on('connection', function(socket){
  //Register
  socket.on('register', function(user,pw){
    io.emit('register_result', 1);
    var user = new UserModel(user, pw);
    socket.username = user._userName;
    user.socket = socket.id;
  });

  //Login
  socket.on('login', function(username,pw){
  	if(authenticate(username, pw)) {
      socket.username = username;
      var user = UserModel.prototype.findUser(username);
      user.socket = socket.id;
      io.emit('login_result', 1);
    }
    else
      io.emit('login_result', 0);
  });

  //Logout
  socket.on('logout', function(){
      var user = UserModel.prototype.findUser(socket.username);
      socket.username = '';
      user.logout();
      io.emit('logout_result');
    });

  //Delete Account
  socket.on('delete', function(){
    var user = UserModel.prototype.findUser(socket.username);
    socket.username = '';
    user.delete();
  });

  //List Articles
  socket.on('list_auctions', function(){
    io.emit('list_auctions_result', AuctionModel.prototype.getLiveAuctions());
  });

  //New bid
  socket.on('new_bid', function(auctionId, value) {
    io.emit('new_bid_result', AuctionModel.prototype.newBid(auctionId, value, socket.username));
  });

  //check bid
  socket.on('check_bid', function(auctionId) {
    io.emit('check_bid_result', AuctionModel.prototype.checkBid(socket.username, auctionId));
  });
});

/*
#############
####SEEDS####
#############
*/

u1 = new UserModel("Fabi", "abc")
u2 = new UserModel("Simon", "abc")

a1 = new ArticleModel("Breitling 320", "Beautiful Watch", 7000)
a2 = new ArticleModel("Samsung S27C450", "Perfect business monitor", 300)
a3 = new ArticleModel("Cuban Cigar", "Legal to buy", 600)
a4 = new ArticleModel("iPhone 6 Plus", "Fance huge phone", 800)
a5 = new ArticleModel("MacBook Pro 13\" retina", "Web developers choice", 1200)

au1 = new AuctionModel(0, Date.now(), Date.now() + 1000 * 60 * 1)
au2 = new AuctionModel(1, Date.now(), Date.now() + 1000 * 60 * 2)
au3 = new AuctionModel(2, Date.now(), Date.now() + 1000 * 60 * 5)
au4 = new AuctionModel(3, Date.now(), Date.now() + 1000 * 60 * 6)
au5 = new AuctionModel(4, Date.now(), Date.now() + 1000 * 60 * 7)

new AuctionModel.prototype.newBid(0, 500, "Fabi");
new AuctionModel.prototype.newBid(0, 400, "Fabi");
new AuctionModel.prototype.newBid(0, 300, "Fabi");
new AuctionModel.prototype.newBid(0, 200, "Fabi");
new AuctionModel.prototype.newBid(0, 100, "Fabi");
new AuctionModel.prototype.newBid(0, 550, "Simon");
new AuctionModel.prototype.newBid(0, 450, "Simon");
new AuctionModel.prototype.newBid(0, 350, "Simon");
new AuctionModel.prototype.newBid(0, 250, "Simon");
new AuctionModel.prototype.newBid(0, 150, "Simon");
new AuctionModel.prototype.newBid(0, 50, "Simon");
new AuctionModel.prototype.newBid(1, 70, "Fabi");
new AuctionModel.prototype.newBid(1, 60, "Simon");
new AuctionModel.prototype.newBid(1, 250, "Simon");
new AuctionModel.prototype.newBid(1, 200, "Simon");

//call checkForEndedAuctions every 1/2 sec
setInterval(function() {
  AuctionModel.prototype.checkForEndedAuctions();
}, 500);

http.listen(3000, function(){
  console.log('listening on *:3000');
});
