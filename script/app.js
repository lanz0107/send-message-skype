// app.js

var restify = require('restify');
var request = require('request');
var async = require('async');
var builder = require('botbuilder');
var fs = require('fs');
var path = require('path');

var server = restify.createServer();
server.use(restify.plugins.bodyParser({
  mapParams: true
}));
server.listen(process.env.port || process.env.PORT || 3978, function () {
  console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new builder.ChatConnector({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=========================================================
// Bots Dialogs
//=========================================================

var intents = new builder.IntentDialog();
bot.dialog('/', intents);

intents.matchesAny([/.*hi.*/i, /.*hello.*/i, /.*こんにちは.*/i], function (session) {
  session.send('こんにちは');
});

intents.matches(/.*hey.*/i, function (session) {
  session.send('hey!');
}).matches(/.*morning.*/i, function (session) {
  session.send('morning');
}).matches(/.*weather:nagoya.*/i, function (session) {
  var texts = session.message.text.split(':');
  if (texts.length !== 2) {
    session.send("I’m sorry, I don’t know. ;(");
    return;
  };
  var targetCity = texts[1];
  session.send("I will check the weather in %s. ;)", targetCity);
  getWeatherData(session, 'Nagoya-shi');
}).matches(/.*weather:bangkok.*/i, function (session) {
  var texts = session.message.text.split(':');
  if (texts.length !== 2) {
    session.send("I’m sorry, I don’t know. ;(");
    return;
  };
  var targetCity = texts[1];
  session.send("I will check the weather in %s. ;)", targetCity);
  getWeatherData(session, 'bangkok');
}).matches(/.*weather:.*/i, function (session) {
  var texts = session.message.text.split(':');
  if (texts.length !== 2) {
    session.send("I’m sorry, I don’t know. ;(");
    return;
  };
  var targetCity = texts[1];
  session.send("I will check the weather in %s. ;)", targetCity);
  console.log(path.join(__dirname, 'city_list.txt'));
  fs.readFile(path.join(__dirname, 'city_list.txt'), 'utf8', function (err, text) {
    if (err) {
      console.log('read text error!!!!');
      console.log(err);
    };
    var reg = new RegExp(targetCity, 'i');
    var arr = text.split(/\r\n|\r|\n/);
    var resultIndex = [];
    var perfectMatchFlag = false;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].match(reg)) {
        if (arr[i].toUpperCase() === targetCity.toUpperCase()) {
          perfectMatchFlag = true;
        }
        resultIndex.push(i);
      };
    };

    if (!perfectMatchFlag && resultIndex.length > 1) {
      var sendMessage = 'More than one city was found.\n\n';
      sendMessage = sendMessage + 'Please select it and try again.\n\n';
      for (var i = 0; i < resultIndex.length; i++) {
        console.log('arr[resultIndex[i]]' + arr[resultIndex[i]]);
        if (i === 0) {
          sendMessage = sendMessage + arr[resultIndex[i]];
        } else {
          sendMessage = sendMessage + ',' + arr[resultIndex[i]];
        }
      };

      if (sendMessage.length > 200) {
        session.send('Please tell me the city in detail. ;(');
      } else {
        session.send(sendMessage);
      };
    } else if (resultIndex.length <= 0) {
      session.send("I’m sorry, I don’t know. ;(");
    } else {
      getWeatherData(session, targetCity);
    };
  });
}).matches(/.*What do you know\?.*/i, function (session) {
  var sendtext = 'I know the weather.\n\n';
  sendtext = sendtext + '[mention] weather:[city]';
  session.send(sendtext);
}).matches(/.*help.*/i, function (session) {
  var sendtext = 'weather.\n\n';
  sendtext = sendtext + '[mention] weather:[city]\n\n';
  sendtext = sendtext + '[mention] weather:nagoya\n\n';
  sendtext = sendtext + '[mention] weather:bangkok';
  session.send(sendtext);
}).matches(/.*thank you.*/i, function(session) {
  session.send('You are welcome. (like)');
}).matches(/.*thanks.*/i, function (session) {
  session.send('You are welcome. (like)');
});

intents.onDefault(function (session) {
  session.send("I’m sorry, I don’t know. ;(");
});

// Sends attachment inline in base64
function sendInternetUrl(session, url, contentType, attachmentFileName) {
  var msg = new builder.Message(session)
    .addAttachment({
      contentUrl: url,
      contentType: contentType,
      name: attachmentFileName
    });

  session.send(msg);
}

function getWeatherData(session, city) {
  var baseCelsius = 273.15;

  var url = 'http://api.openweathermap.org/data/2.5/weather?q=' + city + '&appid=1488a11f10fba472a81f4cdedb0d04c5';

  async.waterfall([
    function (callback) {
      var result = {};
      request(url, function (error, response, body) {
        if (body) {
          console.log(body);
          var parseBody = JSON.parse(body);
          var weathermain = parseBody.weather[0].description;
          var temp = (parseBody.main.temp - baseCelsius);

          var n = 1;	// 小数点第n位まで残す
          temp = Math.floor(temp * Math.pow(10, n)) / Math.pow(10, n);
          temp = temp + '°C';

          var country = parseBody.sys.country;
          var name = parseBody.name;
          var icon = parseBody.weather[0].icon;

          var weatherText = 'weather : ' + weathermain + '\n\n';
          var weatherText = weatherText + 'temp : ' + temp + '\n\n';
          var weatherText = weatherText + 'country : ' + country + '\n\n';
          var weatherText = weatherText + 'city : ' + name + '\n\n';

          result.text = weatherText;
          result.icon = icon;
        };
        if (error) {
          console.log('error!');
          console.log(error);
        };
        console.log(JSON.stringify(response));
        //次の処理を呼び出す。callbackを呼ばないと次の処理は実行されない
        callback(null, result);
      });
    },
  ], function (err, result) {
    if (err) {
      var errormessage = {
        "code": 409,
        "message": "API処理中にエラーが発生しました。"
      };
      res.send(errormessage);
      console.log(err);
      return
    }
    var text = result.text;
    console.log('text:' + text);
    var icon = result.icon;
    console.log('icon:' + icon);
    sendInternetUrl(session, 'http://openweathermap.org/img/w/' + icon + '.png', 'image/png', 'Weather.png');
    session.send(text);
    return;
  });
}

//=========================================================
// API
//=========================================================

function sendMessageSkype(req, res, next) {

  // MicrosoftBotFrameworkのOAuthClient認証を行いaccess_tokenを取得する

  var headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  var options = {
    url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    method: 'POST',
    headers: headers,
    form: {
      'grant_type': 'client_credentials',
      'client_id': '31df04c5-00e6-4e1e-98a0-e04a7e292e9b',
      'client_secret': 'YZzoCR9LwicAwSsqAfRjN0N',
      'scope': 'https://graph.microsoft.com/.default'
    }
  };

  async.waterfall([
    function (callback) {
      var access_token;
      request(options, function (error, response, body) {
        if (body) {
          console.log('succes!');
          console.log(body);
          access_token = JSON.parse(body)['access_token'];
        };
        if (error) {
          console.log('error!');
          console.log(error);
        };
        console.log(JSON.stringify(response));
        //次の処理を呼び出す。callbackを呼ばないと次の処理は実行されない
        callback(null, access_token);
      });
    },
    function (access_token, callback) {
      console.log('access_token:' + access_token);
      // MicrosoftBotFrameworkのチャット投稿用RESTAPIを叩く
      var target_chat = req.params.group_chat_id;
      var serviceUrl = 'https://skype.botframework.com';
      var url = serviceUrl + '/v3/conversations/' + target_chat + '/activities';
      var message = req.params.message;
      var headers = {
        'Authorization': 'Bearer ' + access_token
      };
      var data = {
        'type': 'message',
        'text': message
      };
      var options = {
        url: url,
        method: 'POST',
        headers: headers,
        json: data
      };

      var result;

      request(options, function (error, response, body) {
        if (body) {
          console.log('response.statusCode:' + response.statusCode);
          if (201 === response.statusCode) {
            result = {
              "code": 201,
              "message": "正常終了しました。"
            }
          } else {
            result = {
              "code": 409,
              "message": "API処理中にエラーが発生しました。",
              "errorResponse": response
            }
          }
          console.log('send skype:');
          console.log(body);
        };
        if (error) {
          console.log('error!');
          console.log(error);
        };
        console.log(JSON.stringify(response));

        callback(null, result);
      });
    },
  ], function (err, send_message) {
    if (err) {
      var errormessage = {
        "code": 409,
        "message": "API処理中にエラーが発生しました。"
      };
      res.send(errormessage);
      console.log(err);
      return
    }
    res.send(send_message);
    return
  });

};

server.post('/api/send_message_skype', sendMessageSkype);