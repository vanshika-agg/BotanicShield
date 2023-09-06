var assert = require('chai').assert;
const app = require('./app');

describe('basictest', function(){
    describe('multipliaction', function(){
        it('should give 15 when 5 is multiplied with 3', function(){
            var result = 5*3;
            assert.equal(15,result);
        });
    });
});

describe('app'  , function(){
    it('should return hello', function(){
        assert.equal(app(), 'hello');
    });
});