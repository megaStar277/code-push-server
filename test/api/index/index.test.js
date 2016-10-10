var app = require('../../../app');
var request = require('supertest')(app);
var should = require("should");
var _ = require('lodash');

describe('api/index/index.test.js', function() {
  var account = '522539441@qq.com';
  var password = '123456';
  var authToken;
  before(function(done){
    request.post('/auth/login')
    .send({
      account: account,
      password: password
    })
    .end(function(err, res) {
      should.not.exist(err);
      var rs = JSON.parse(res.text);
      rs.should.containEql({status:"OK"});
      authToken = (new Buffer(`auth:${_.get(rs, 'results.tokens')}`)).toString('base64');
      done();
    });
  });

  describe('render index views', function(done) {
    it('should render index views successful', function(done) {
      request.get(`/`)
      .send()
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.equal(200);
        done();
      });
    });
  });

  describe('render README.md views', function(done) {
    it('should render README.md  views successful', function(done) {
      request.get(`/README.md`)
      .send()
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.equal(200);
        done();
      });
    });
  });

  describe('render tokens views', function(done) {
    it('should render tokens views successful', function(done) {
      request.get(`/tokens`)
      .send()
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.equal(200);
        done();
      });
    });
  });

  describe('authenticated', function(done) {
    it('should authenticated successful', function(done) {
      request.get(`/authenticated`)
      .set('Authorization', `Basic ${authToken}`)
      .send()
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.equal(200);
        done();
      });
    });
  });

});
