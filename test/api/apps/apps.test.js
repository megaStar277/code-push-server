var app = require('../../../app');
var request = require('supertest')(app);
var should = require("should");
var security = require('../../../core/utils/security');
var factory = require('../../../core/utils/factory');
var _ = require('lodash');

describe('api/apps/apps.test.js', function() {
  var account = '522539441@qq.com';
  var password = '123456';
  var authToken;
  var machineName = `Login-${Math.random()}`;
  var friendlyName = `Login-${Math.random()}`;
  var appName = 'ios_test';
  var bearerToken;

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

  describe('create accessKeys', function(done) {
    it('should create accessKeys successful', function(done) {
      request.post(`/accessKeys`)
      .set('Authorization', `Basic ${authToken}`)
      .send({createdBy: machineName, friendlyName: friendlyName, isSession: true, ttl: 30*24*60*60})
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.equal(200);
        var rs = JSON.parse(res.text);
        rs.should.have.properties('accessKey');
        rs.accessKey.should.have.properties(['name', 'createdTime', 'createdBy',
          'expires', 'isSession', 'description', 'friendlyName']);
        bearerToken = _.get(rs, 'accessKey.name');
        done();
      });
    });
  });

  describe('add apps', function(done) {
    it('should not add apps successful when appName is empty', function(done) {
      request.post(`/apps`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .send({})
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.equal(406);
        res.text.should.equal(`Please input name!`);
        done();
      });
    });

    it('should not add apps successful when appName is invalid', function(done) {
      var appName = 'test';
      request.post(`/apps`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .send({name: appName})
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.equal(406);
        res.text.should.equal(`appName have to point android_ or ios_ prefix! like android_${appName} ios_${appName}`);
        done();
      });
    });

    it('should add apps successful', function(done) {
      request.post(`/apps`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .send({name: appName})
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.equal(200);
        var rs = JSON.parse(res.text);
        rs.should.have.properties('app');
        rs.app.should.have.properties(['name', 'collaborators']);
        done();
      });
    });

    it('should not add apps successful when appName exists', function(done) {
      request.post(`/apps`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .send({name: appName})
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.equal(406);
        res.text.should.equal(`${appName} Exist!`);
        done();
      });
    });

  });

});
