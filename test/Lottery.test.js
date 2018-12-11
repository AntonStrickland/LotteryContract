const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const provider = ganache.provider();
const web3 = new Web3(provider);
const { interface, bytecode } = require('../compile');

let lottery;
let accounts;

beforeEach(async () => {
  accounts = await web3.eth.getAccounts();
  lottery = await new web3.eth.Contract(JSON.parse(interface))
  .deploy({data: bytecode})
  .send({from: accounts[0], gas: '1000000'});
});

describe('Lottery Contract', () => {

  it('deploys a contract', () => {
    assert.ok(lottery.options.address);
  });

  it('allows one account to enter', async () => {
    await lottery.methods.enter().send( {
      from: accounts[0],
      value: web3.utils.toWei('0.02', 'ether')
    });

    const players = await lottery.methods.getPlayers().call( {
      from: accounts[0]
    });

    assert.equal(accounts[0], players[0]);
    assert.equal(1, players.length);
  });

  it('allows multiple accounts to enter', async () => {

    // Player 1 enters
    await lottery.methods.enter().send( {
      from: accounts[0],
      value: web3.utils.toWei('0.02', 'ether')
    });

    // Player 2 enters
    await lottery.methods.enter().send( {
      from: accounts[1],
      value: web3.utils.toWei('0.02', 'ether')
    });

    // Player 3 enters
    await lottery.methods.enter().send( {
      from: accounts[2],
      value: web3.utils.toWei('0.02', 'ether')
    });

    const players = await lottery.methods.getPlayers().call( {
      from: accounts[0]
    });

    assert.equal(accounts[0], players[0]);
    assert.equal(accounts[1], players[1]);
    assert.equal(accounts[2], players[2]);
    assert.equal(3, players.length);

  });


  it ('requires a minimum amount of ether to enter', async() => {

    try {
      await lottery.methods.enter().send({
        from: accounts[0],
        value: 0
      });
      assert(false);
    } catch (err) {
      assert(err);
    }

  });

  it ('requires that only manager can pick winner', async() => {

    try {
      await lottery.methods.pickWinner().send({
        from: accounts[1]
      });
      assert(false);
    } catch (err) {
      assert(err);
    }

  });

  it ('sends money to the winner and resets the player array', async () => {

    await lottery.methods.enter().send ({
      from: accounts[0],
      value: web3.utils.toWei('2', 'ether')
    });

    const initialBalance = await web3.eth.getBalance(accounts[0]);
    await lottery.methods.pickWinner().send( {from: accounts[0]});
    const finalBalance = await web3.eth.getBalance(accounts[0]);

    const difference = finalBalance - initialBalance;

    // Assert that money was sent to the winner
    assert(difference > web3.utils.toWei('1.8', 'ether'));

    // Assert that the player array was reset
    const players = await lottery.methods.getPlayers().call( {
      from: accounts[0]
    });

    assert(players.length == 0);

    // Assert that the lottery has a balance of zero
    const lotteryBalance = await web3.eth.getBalance(lottery.options.address);
    assert(lotteryBalance == 0);
  });

});
