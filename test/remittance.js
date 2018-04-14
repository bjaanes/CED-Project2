var Remittance = artifacts.require("./Remittance.sol");

contract("Remittance", function(accounts) {
  var contract;

  const account0 = accounts[0];
  const account1 = accounts[1];
  const account2 = accounts[2];

  const password = "secret123";
  const puzzle = solSha3(password, account1);
  console.log(puzzle);

  beforeEach(async () => {
    contract = await Remittance.new({ from: account0 });
  });

  it("should have set owner correctly", async () => {
    let actualOwnerAddress = await contract.owner();

    assert.strictEqual(
      actualOwnerAddress,
      account0,
      "owner is not set up correctly"
    );
  });

  describe("createRemittance", function() {
    it("should fail if no ethere is sent in", async () => {
      try {
        await contract.createRemittance(puzzle, 100, account1, {
          from: account0,
          value: 0
        });
      } catch (e) {
        return true;
      }

      throw new Error("Should fail when no Ether sent in");
    });

    it("should fail if deadline is equal to the limit", async () => {
      try {
        await contract.createRemittance(puzzle, 40320, account1, {
          from: account0,
          value: 100
        });
      } catch (e) {
        return true;
      }

      throw new Error("Should fail when deadline equal to the limit");
    });

    it("should fail if deadline is above to the limit", async () => {
      try {
        await contract.createRemittance(puzzle, 40321, account1, {
          from: account0,
          value: 100
        });
      } catch (e) {
        return true;
      }

      throw new Error("Should fail when deadline is above the limit");
    });

    it("should create a remittance with the correct values", async () => {
      const tx = await contract.createRemittance(puzzle, 100, account1, {
        from: account0,
        value: 1000
      });

      const remittance = await contract.remittances(puzzle);
      assert.strictEqual(
        remittance[0].toString(10),
        "1000",
        "amount is not correct"
      );
      assert.strictEqual(
        remittance[1].toString(10),
        tx.receipt.blockNumber + 100 + "",
        "deadline is not correct"
      );
      assert.strictEqual(remittance[2], account0, "issuer is not correct");
      assert.strictEqual(remittance[3], account1, "recipient is not correct");
    });

    it("should fail if remittance already exists", async () => {
      await contract.createRemittance(puzzle, 100, account1, {
        from: account0,
        value: 1000
      });

      try {
        await contract.createRemittance(puzzle, 100, account1, {
          from: account0,
          value: 1001
        });
      } catch (e) {
        return true;
      }

      throw new Error("Should fail when remittance already exists");
    });

    it("should fail if remittance already exists, but is claimed", async () => {
      await contract.createRemittance(puzzle, 100, account1, {
        from: account0,
        value: 1000
      });

      await contract.claimRemittance(password, {
        from: account1
      });

      try {
        await contract.createRemittance(puzzle, 100, account1, {
          from: account0,
          value: 1001
        });
      } catch (e) {
        return true;
      }

      throw new Error(
        "Should fail when remittance already exists but is claimed"
      );
    });
  });

  describe("claimRemittance", function() {

    it("should fail if solution doesn't exist", async () => {
      const tx = await contract.createRemittance(puzzle, 1000, account1, {
        from: account0,
        value: 100
      });

      try {
        await contract.claimRemittance("attack", {
          from: account0
        });
      } catch (e) {
        return true;
      }

      throw new Error("Should fail when solution doesn't exist");
    });

    it("should fail if sender is not recipient", async () => {
      const tx = await contract.createRemittance(puzzle, 1000, account1, {
        from: account0,
        value: 100
      });

      try {
        await contract.claimRemittance(password, {
          from: account2
        });
      } catch (e) {
        return true;
      }

      throw new Error("Should fail when sender is not recipient");
    });

    it("should fail if deadline is passed", async () => {
      const tx = await contract.createRemittance(puzzle, 0, account1, {
        from: account0,
        value: 100
      });

      const remittance = await contract.remittances(puzzle);
      await mineBlock(remittance[1].toNumber());

      try {
        await contract.claimRemittance(password, {
          from: account1
        });
      } catch (e) {
        return true;
      }

      throw new Error("Should fail when solution doesn't exist");
    });

    it("should send correct amount of ether if everything is OK", async () => {
      const tx = await contract.createRemittance(puzzle, 1000, account1, {
        from: account0,
        value: 100
      });

      let beforeBalance = await web3.eth.getBalance(account1);
      const claimTx = await contract.claimRemittance(password, {
        from: account1
      });

      const gasUsed = claimTx.receipt.gasUsed;
      const gasPrice = (await web3.eth.getTransaction(claimTx.tx)).gasPrice;

      let actualBalance = await web3.eth.getBalance(account1);
      assert.strictEqual(
        actualBalance.toString(10),
        beforeBalance
          .plus(100)
          .minus(gasPrice.mul(gasUsed))
          .toString(10),
        "Account1 has not gotten the correct amound from remittance"
      );
    });

    it("should set remittance to claimed for the puzzle", async () => {
      const tx = await contract.createRemittance(puzzle, 1000, account1, {
        from: account0,
        value: 100
      });

      await contract.claimRemittance(password, {
        from: account1
      });

      const remittance = await contract.remittances(puzzle);
      assert.strictEqual(
        remittance[0].toString(10),
        "100",
        "amount is not correct"
      );
      assert.strictEqual(
        remittance[1].toString(10),
        tx.receipt.blockNumber + 1000 + "",
        "deadline is not correct"
      );
      assert.strictEqual(remittance[2], account0, "issuer is not correct");
      assert.strictEqual(remittance[3], account1, "recipient is not correct");
      assert.strictEqual(remittance[4], true, "not set to claimed");
    });

    it("should fail if try to claim same remittance twice", async () => {
      const tx = await contract.createRemittance(puzzle, 1000, account1, {
        from: account0,
        value: 100
      });
      
      await contract.claimRemittance(password, {
        from: account1
      });

      try {
        await contract.claimRemittance(password, {
          from: account1
        });
      } catch (e) {
        return true;
      }

      throw new Error("Should fail when already claimed");
    });
  });

  describe("reclaimRemittance", function() {
    it("should fail if deadline is not over yet", async () => {
      await contract.createRemittance(puzzle, 1000, account1, {
        from: account0,
        value: 100
      });

      try {
        await contract.reclaimRemittance(password, {
          from: account0
        });
      } catch (e) {
        return true;
      }

      throw new Error("Should fail when deadline is not met");
    });

    it("should fail if sender is not issuer", async () => {
      await contract.createRemittance(puzzle, 0, account1, {
        from: account0,
        value: 100
      });

      const remittance = await contract.remittances(puzzle);
      await mineBlock(remittance[1].toNumber());

      try {
        await contract.reclaimRemittance(puzzle, {
          from: account1
        });
      } catch (e) {
        return true;
      }

      throw new Error("Should fail when sender is not issuer");
    });

    it("should transfer back the correct amount of ether if reclaimed", async () => {
      await contract.createRemittance(puzzle, 0, account1, {
        from: account0,
        value: 100
      });

      const remittance = await contract.remittances(puzzle);
      await mineBlock(remittance[1].toNumber());

      let beforeBalance = await web3.eth.getBalance(account0);
      const reclaimTx = await contract.reclaimRemittance(puzzle, {
        from: account0
      });

      const gasUsed = reclaimTx.receipt.gasUsed;
      const gasPrice = (await web3.eth.getTransaction(reclaimTx.tx)).gasPrice;

      let actualBalance = await web3.eth.getBalance(account0);
      assert.strictEqual(
        actualBalance.toString(10),
        beforeBalance
          .plus(100)
          .minus(gasPrice.mul(gasUsed))
          .toString(10),
        "Account0 has not gotten the correct amound from reclaim"
      );
    });

    it("should set remittance to claimed for the puzzle", async () => {
      await contract.createRemittance(puzzle, 0, account1, {
        from: account0,
        value: 100
      });

      const remittance = await contract.remittances(puzzle);
      await mineBlock(remittance[1].toNumber());

      let beforeBalance = await web3.eth.getBalance(account0);
      const reclaimTx = await contract.reclaimRemittance(puzzle, {
        from: account0
      });

      const remittanceAfter = await contract.remittances(puzzle);
      assert.strictEqual(
        remittanceAfter[0].toString(10),
        "100",
        "amount is not correct"
      );
      assert.strictEqual(
        remittanceAfter[1].toString(10),
        reclaimTx.receipt.blockNumber - 1 + "",
        "deadline is not correct"
      );
      assert.strictEqual(remittanceAfter[2], account0, "issuer is not correct");
      assert.strictEqual(
        remittanceAfter[3],
        account1,
        "recipient is not correct"
      );
      assert.strictEqual(remittanceAfter[4], true, "claimed not set to true");
    });
  });

  describe("pause", function() {
    it("should revert if sender is not owner", async () => {
      try {
        await contract.pause({ from: account1 });
      } catch (e) {
        return true;
      }

      throw new Error(
        "Should fail when anyone but Owner (account0) tries to pause"
      );
    });

    it("should fail if tries to pause after is paused", async () => {
      await contract.pause({ from: account0 });

      try {
        await contract.pause({ from: account0 });
      } catch (e) {
        return true;
      }

      throw new Error("Should fail tries to pause after being paused");
    });

    it("should fail if tries to createRemittance after is paused", async () => {
      await contract.pause({ from: account0 });

      try {
        await contract.createRemittance(puzzle, 0, account1, {
          from: account0,
          value: 100
        });
      } catch (e) {
        return true;
      }

      throw new Error(
        "Should fail tries to createRemittance after being paused"
      );
    });

    it("should fail if tries to claimRemittance after is paused", async () => {
      await contract.createRemittance(puzzle, 0, account1, {
        from: account0,
        value: 100
      });

      await contract.pause({ from: account0 });

      try {
        await contract.claimRemittance(password, {
          from: account1
        });
      } catch (e) {
        return true;
      }

      throw new Error(
        "Should fail tries to claimRemittance after being paused"
      );
    });

    it("should fail if tries to reclaimRemittance after is paused", async () => {
      await contract.createRemittance(puzzle, 0, account1, {
        from: account0,
        value: 100
      });
      const remittance = await contract.remittances(puzzle);
      await mineBlock(remittance[1].toNumber());

      await contract.pause({ from: account0 });

      try {
        await contract.reclaimRemittance(puzzle, {
          from: account0
        });
      } catch (e) {
        return true;
      }

      throw new Error(
        "Should fail tries to reclaimRemittance after being paused"
      );
    });
  });

  describe("resume", function() {
    it("should revert if sender is not owner", async () => {
      await contract.pause({ from: account0 });

      try {
        await contract.resume({ from: account1 });
      } catch (e) {
        return true;
      }

      throw new Error(
        "Should fail when anyone but Owner (account0) tries to resume"
      );
    });

    it("should not fail if tries to createRemittance after is resumed", async () => {
      await contract.pause({ from: account0 });
      await contract.resume({ from: account0 });

      try {
        await contract.createRemittance(puzzle, 10, account1, {
          from: account0,
          value: 100
        });
      } catch (e) {
        throw new Error("Should not fail after resumed");
      }
    });

    it("should not fail if tries to claimRemittance after is resumed", async () => {
      await contract.createRemittance(puzzle, 10, account1, {
        from: account0,
        value: 100
      });

      await contract.pause({ from: account0 });
      await contract.resume({ from: account0 });

      try {
        await contract.claimRemittance(password, {
          from: account1
        });
      } catch (e) {
        throw new Error("Should not fail after resumed");
      }
    });

    it("should not fail if tries to reclaimRemittance after is resumed", async () => {
      await contract.createRemittance(puzzle, 0, account1, {
        from: account0,
        value: 100
      });
      const remittance = await contract.remittances(puzzle);
      await mineBlock(remittance[1].toNumber());

      await contract.pause({ from: account0 });
      await contract.resume({ from: account0 });

      try {
        await contract.reclaimRemittance(puzzle, {
          from: account0
        });
      } catch (e) {
        throw new Error("Should not fail after resumed");
      }
    });
  });
});

function solSha3(...args) {
  args = args.map(arg => {
    if (typeof arg === "string") {
      if (arg.substring(0, 2) === "0x") {
        return arg.slice(2);
      } else {
        return web3.toHex(arg).slice(2);
      }
    }

    if (typeof arg === "number") {
      return leftPad(arg.toString(16), 64, 0);
    } else {
      return "";
    }
  });

  args = args.join("");

  return web3.sha3(args, { encoding: "hex" });
}

function mineBlock(until) {
  return new Promise(function(resolve, reject) {
    let currentBlock = web3.eth.blockNumber;
    console.log("Mining next block", currentBlock);

    if (currentBlock >= until) {
      return resolve(currentBlock);
    }

    web3.currentProvider.sendAsync(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        id: 12345
      },
      (error, result) => {
        if (error !== null) return reject(error);

        return mineBlock(until).then(block => {
          resolve(block);
        });
      }
    );
  });
}
