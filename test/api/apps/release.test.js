var app = require('../../../app');
var request = require('supertest')(app);
var should = require("should");
var path = require("path");
var security = require('../../../core/utils/security');
var factory = require('../../../core/utils/factory');
var _ = require('lodash');

describe('api/apps/release.test.js', function() {
  var account = '522539441@qq.com';
  var password = '123456';
  var authToken;
  var machineName = `Login-${Math.random()}`;
  var friendlyName = `Login-${Math.random()}`;
  var appName = 'ios_demo';
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
  });

  describe('release apps', function(done) {
    it('should release apps successful', function(done) {
      request.post(`/apps/${appName}/deployments/Staging/release`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .attach('package', path.resolve(__dirname, './bundle.zip'))
      .field('packageInfo', `{"appVersion": "1.0.0", "description": "test", "isMandatory": false}`)
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.equal(200);
        done();
      });
    });
  });

  describe('promote apps', function(done) {
    it('should promote apps successful', function(done) {
      request.post(`/apps/${appName}/deployments/Staging/promote/Production`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .send()
      .end(function(err, res) {
        should.not.exist(err);
        res.status.should.equal(200);
        done();
      });
    });
  });
});
