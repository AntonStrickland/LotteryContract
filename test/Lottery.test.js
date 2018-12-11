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

  it ('requires that only manager can cancel the lottery', async() => {

    try {
      await lottery.methods.cancelLottery().send({
        from: accounts[1]
      });
      assert(false);
    } catch (err) {
      assert(err);
    }

  });

  it('can return the wagered amount to each player', async() => {

    // Player 1 enters
    await lottery.methods.enter().send( {
      from: accounts[0],
      value: web3.utils.toWei('1', 'ether')
    });

    // Player 2 enters
    await lottery.methods.enter().send( {
      from: accounts[1],
      value: web3.utils.toWei('2', 'ether')
    });

    // Player 3 enters
    await lottery.methods.enter().send( {
      from: accounts[2],
      value: web3.utils.toWei('3', 'ether')
    });

    // Assert that each wager is correctly stored in the lottery
    let wager1 = await lottery.methods.wagerOf(accounts[0]).call( {
      from: accounts[0]
    });

    let wager2 = await lottery.methods.wagerOf(accounts[1]).call( {
      from: accounts[0]
    });

    let wager3 = await lottery.methods.wagerOf(accounts[2]).call( {
      from: accounts[0]
    });

    assert.equal(web3.utils.toWei('1', 'ether'), wager1);
    assert.equal(web3.utils.toWei('2', 'ether'), wager2);
    assert.equal(web3.utils.toWei('3', 'ether'), wager3);

    const initialBalance1 = await web3.eth.getBalance(accounts[0]);
    const initialBalance2 = await web3.eth.getBalance(accounts[1]);
    const initialBalance3 = await web3.eth.getBalance(accounts[2]);

    // Manager cancels the lottery
    await lottery.methods.cancelLottery().send({
      from: accounts[0]
    });

    // Assert that all players have been refunded exactly what they wagered
    const finalBalance1 = await web3.eth.getBalance(accounts[0]);
    const finalBalance2 = await web3.eth.getBalance(accounts[1]);
    const finalBalance3 = await web3.eth.getBalance(accounts[2]);

    const difference1 = finalBalance1 - initialBalance1;
    const difference2 = finalBalance2 - initialBalance2;
    const difference3 = finalBalance3 - initialBalance3;

    assert(difference1 > web3.utils.toWei('0.8', 'ether'));
    assert(difference2 > web3.utils.toWei('1.8', 'ether'));
    assert(difference3 > web3.utils.toWei('2.8', 'ether'));

    // Assert that all wagers have been reset to zero
    wager1 = await lottery.methods.wagerOf(accounts[0]).call( {
      from: accounts[0]
    });

    wager2 = await lottery.methods.wagerOf(accounts[1]).call( {
      from: accounts[0]
    });

    wager3 = await lottery.methods.wagerOf(accounts[2]).call( {
      from: accounts[0]
    });

    assert.equal(0, wager1);
    assert.equal(0, wager2);
    assert.equal(0, wager3);

    // Assert that the list of players is empty
    const players = await lottery.methods.getPlayers().call( {
      from: accounts[0]
    });
    assert(players.length == 0);

    // Assert that the lottery has a balance of zero
    const lotteryBalance = await web3.eth.getBalance(lottery.options.address);
    assert(lotteryBalance == 0);

  });

});
