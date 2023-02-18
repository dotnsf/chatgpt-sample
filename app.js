//. app.js
var express = require( 'express' ),
    bodyParser = require( 'body-parser' ),
    request = require( 'request' ),
    app = express();

require( 'dotenv' ).config();

app.use( express.static( __dirname + '/public' ) );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );
app.use( express.Router() );

var IGNORE_PHRASE = 10;  //. 結果の最初のフレーズがこの長さ以下だったら無視する

var settings_cors = 'CORS' in process.env ? process.env.CORS : '';
app.all( '/*', function( req, res, next ){
  if( settings_cors ){
    var origin = req.headers.origin;
    if( origin ){
      var cors = settings_cors.split( " " ).join( "" ).split( "," );

      //. cors = [ "*" ] への対応が必要
      if( cors.indexOf( '*' ) > -1 ){
        res.setHeader( 'Access-Control-Allow-Origin', '*' );
        res.setHeader( 'Vary', 'Origin' );
      }else{
        if( cors.indexOf( origin ) > -1 ){
          res.setHeader( 'Access-Control-Allow-Origin', origin );
          res.setHeader( 'Vary', 'Origin' );
        }
      }
    }
  }
  next();
});

app.get( '/ping', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  res.write( JSON.stringify( { status: true, message: 'PONG' }, null, 2 ) );
  res.end();
});

var settings_apikey = 'API_KEY' in process.env ? process.env.API_KEY : '';

app.post( '/api/complete', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var prompt = req.body.prompt;

  //. 問い合わせ準備
  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + settings_apikey
  };
  var body = {
    model: 'text-davinci-003',
    prompt: prompt,
    max_tokens: 4000
  };
  var option = {
    url: 'https://api.openai.com/v1/completions',
    method: 'POST',
    headers: headers,
    body: JSON.stringify( body )
  };

  //. 問い合わせ
  request( option, ( err, response, body ) => {
    if( err ){
      console.log( { err } );
      res.status( 400 );
      res.write( JSON.stringify( { status: false, error: err }, null, 2 ) );
      res.end();
    }else{
      if( typeof body == 'string' ){
        body = JSON.parse( body );
      }
      
      //. レートリミットに達していると body = { "message": "API rate limit  exceeded for xx.xx.xx.xx. (But here's the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)","documentation_url":"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting" }
      if( body.message ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, error: body.message }, null, 2 ) );
        res.end();
      }else if( body.error && body.error.message ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, error: body.error.message }, null, 2 ) );
        res.end();
      }else{
        //console.log( JSON.stringify( body.choices, null, 2 ) );
        var answer = body.choices[0].text;

        //. 最初の "\n\n" 以降が正しい回答？
        var tmp = answer.split( "\n\n" );
        if( tmp.length > 1 && tmp[0].length < IGNORE_PHRASE ){
          tmp.shift();
          answer = tmp.join( "\n\n" );
        }

        res.write( JSON.stringify( { status: true, result: answer }, null, 2 ) );
        res.end();
      }
    }
  });
});

var port = process.env.PORT || 8080;
app.listen( port );
console.log( "server starting on " + port + " ..." );

module.exports = app;
