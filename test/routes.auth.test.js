var app = require('../app');
var request = require('supertest')(app);
var should = require("should");

describe('routes/auth/test.js', function() {
  var account = 'lisong2010@gmail.com';
  var password = '123456';
  describe('sign in', function(done) {
    it('should not sign in successful when account is empty', function(done) {
      request.post('/auth/login')
      .send({
        account: '',
        password: password
      })
      .end(function(err, res) {
        should.not.exist(err);
        res.text.should.equal(`{"status":"ERROR","errorMessage":"请您输入邮箱地址"}`);
        done();
      });
    });
    it('should not sign in successful when account is not exist', function(done) {
      request.post('/auth/login')
      .send({
        account: account + '1',
        password: password
      })
      .end(function(err, res) {
        should.not.exist(err);
        res.text.should.equal(`{"status":"ERROR","errorMessage":"您输入的邮箱或密码有误"}`);
        done();
      });
    });
    it('should not sign in successful when password is wrong', function(done) {
      request.post('/auth/login')
      .send({
        account: account,
        password: password + '1'
      })
      .end(function(err, res) {
        should.not.exist(err);
        res.text.should.equal(`{"status":"ERROR","errorMessage":"您输入的邮箱或密码有误"}`);
        done();
      });
    });
    it('should sign in successful', function(done) {
      request.post('/auth/login')
      .send({
        account: account,
        password: password
      })
      .end(function(err, res) {
        should.not.exist(err);
        JSON.parse(res.text).status.should.equal('OK')
        done();
      });
    });
  });

  describe('logout', function(done) {
    it('should logout successful', function(done) {
      request.post('/auth/logout')
      .end(function(err, res) {
        should.not.exist(err);
        res.text.should.equal('ok');
        done();
      });
    });
  });

  describe('link', function(done) {
    it('should link successful', function(done) {
      request.get('/auth/link')
      .end(function(err, res) {
        should.not.exist(err);
        res.headers.location.should.equal('/auth/login');
        done();
      });
    });
  });
});
