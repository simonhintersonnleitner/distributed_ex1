var socket = io.connect('http://localhost', {path: "/public/socket.io"});
var loggedIn = false;
$(document).ready(function (){

  $('#logout').hide();
  $('#delete').hide();
  $('#header').hide();

  $('#logout').click(function(){
    console.log('logout');
    socket.emit('logout');
  });

  socket.on('disconnect', function(res){
    loggedIn = false;
    changeOutputText("Conncection lost!","danger");
    logout();
  });

  socket.on('logout_result', function(res){
    loggedIn = false;
    changeOutputText("You have been loged out!","warning");
    logout();
  });

  $('#delete').click(function(){
    console.log('delete');
    socket.emit('delete');
  });

  socket.on('delete_result', function(res){
    changeOutputText("You have been deleted!","warning");
    logout();
  });

  $('#pw').keydown(function(e) {
    if (e.keyCode == 13) {
        login();
    }
  });

  $('#login').click(function(){
    socket.emit('login', $('#user').val(),$('#pw').val());
  });
  socket.on('login_result', function(res){


          console.log('login_result');

    if(res == 1)
    {

      loggedIn = true;
      $('#login').hide();
      $('#register').hide();
      $('#form_user').hide();
      $('#form_pw').hide();
      $('#logout').show();
      $('#delete').show();

      changeOutputText("Login successfull!","success");

      socket.emit('list_auctions');
    }
   	else
   		changeOutputText("Login  failed!","danger");
  });

  socket.on('list_auctions_result', function(res){
        
        $('#header').show();

        if(res.length == 0){
          $('#articleList').find('#output').remove();
          $('#articleList').append('<tr id=output>');
          $('#articleList').find('#output').append('<td>no runnig auction found!</td><td></td><td></td><td></td><td></td><td></td>')
        }else{
          res.forEach(function(auction){
          addNewAuction(auction);
          });
        }

      socket.on('register_result', function(res){
        console.log("register_result " + res);

        if(res == 1){
          loggedIn = true;
          changeOutputText("Registration success",'success');
        }
        else
          changeOutputText("Registration failed!",'danger');
      });

      socket.on('auction_ended', function(auctionId){
        if(loggedIn){
          console.log("auction_ended id:" + auctionId);
          $('#time_' + auctionId).remove();
          $('#bidform_' + auctionId).remove();
          $('#check_' + auctionId).remove();
          $('#row_' + auctionId).find('td').eq(3).empty();
          $('#row_' + auctionId).find('td').eq(3).append("Time is over!")
        }
      });

      socket.on('win_result', function(res){
        if(loggedIn)
          $('#row_' + res).find('td').eq(4).append("You have won this auction!")
      });

      socket.on('new_auction', function(auction){
        if(loggedIn)
          addNewAuction(auction);
    });
  });

  socket.on('new_bid_result', function(res){
    $('#output').empty();
    if(res == -1) {
      changeOutputText("Congratulation you have the lowest single-bid!",'success');
    }
    else if(res == 1) {
      changeOutputText("You have an single-bid but its to high",'warning');
    }
    else if(res == -2) {
      changeOutputText("The auction ist timed out or the bid is invalid",'danger');
    }
    else {
      changeOutputText(res + " other people have the same bid as you!",'warning');
    }
  });

   socket.on('check_bid_result', function(res){
    $('#output').empty();
    if(res == -1) {
      changeOutputText("You have not set an bid!",'danger');
    }
    else if(res == 1) {
      changeOutputText("Congratulation you have actually the lowest single-bid!",'success');
    }
    else {
      changeOutputText("Sorry you dont have the lowest single-bid at this moment!",'warning');
    }
  });

  $('#register').click(function(){
  socket.emit('register', $('#user').val(),$('#pw').val());
  });

  

});

function addNewAuction(auction) {
  $('#articleList').find('#output').remove();
  $('#articleList').find("#row_"+auction._id).remove();
  $('#articleList').append("<tr id='row_"+auction._id+"''>");
  $('#articleList').find("#row_"+auction._id).append("<td>"+auction._article._name+"</td>");
  $('#articleList').find("#row_"+auction._id).append("<td>"+auction._article._description+"</td>");
  $('#articleList').find("#row_"+auction._id).append("<td>"+auction._article._regularPrice+" €</td>");

  $('#articleList').find("#row_"+auction._id).append("<td><div class='time' id='time_"+auction._id+"' data-end="+auction._endsAt+">" + getRemaing(auction._endsAt)+"</div></td>");
  $('#articleList').find("#row_"+auction._id).append("<td><div class='form-inline' id='bidform_"+auction._id+"'><input type='text'  id='value_"+auction._id+"' data-id="+auction._id+" class='form-control bid_value'><button class='btn btn-default bid' data-id="+auction._id+">Bid</button></div></td>");
  $('#articleList').find("#row_"+auction._id).append("<td><button class='btn btn-default check' id='check_"+auction._id+"' data-id="+auction._id+">Check</button></td>");
  $('#articleList').append("</tr>");    
  setInterval(function() {updateTime(auction._id);}, 1000);
  activateButtons();
}

function activateButtons(){
  $('.bid').off();
  $('.bid').click(function() {
    bid(this);
  });

  $('.bid_value').keydown(function(e) {
    if (e.keyCode == 13) {
        bid(this);
    }
  });
  $('.check').off();
  $('.check').click(function() {
    var auctionId = $(this).data('id');
    socket.emit('check_bid', auctionId);
  });
} 

function login() {
  socket.emit('login', $('#user').val(),$('#pw').val());
}

function logout(){
  $('#login').show();
  $('#register').show();
  $('#form_user').show();
  $('#form_pw').show();
  $('#logout').hide();
  $('#delete').hide();
  $('#articleList').empty();
}

function bid(that){
  console.log('bid!');
  var auctionId = $(that).data('id');
  var value = $('#value_' + auctionId).val();
  socket.emit('new_bid', auctionId, value);
  console.log("bid:" + auctionId + " " + value);
  $('.bid_value').val("");
}

function getRemaing(dateString){
  var date1 = new Date();
  var date2 = new Date(dateString);
  var diff = new Date(date2.getTime() - date1.getTime());

  var days = diff.getUTCDate()-1;
  var seconds = diff.getUTCSeconds();
  var houres = diff.getUTCHours();
  var minutes = diff.getUTCMinutes()
  
  return(days  +"d - "+ ('0' + houres).slice(-2) + ":"+ ('0' + minutes).slice(-2) + ":" + ('0' + seconds).slice(-2));
}

function updateTime(auctionId){
  var remainingTime = getRemaing($('#time_' + auctionId).data('end'));
  $('#time_' + auctionId).empty();
  $('#time_' + auctionId).append(remainingTime);

}
function changeOutputText(msg,mode){
  $('#output').empty();
  $('#output').append(msg);
  $('#output').removeClass('alert-danger');
  $('#output').removeClass('alert-warning');
  $('#output').removeClass('alert-success');
  $('#output').addClass('alert-' + mode);
}

