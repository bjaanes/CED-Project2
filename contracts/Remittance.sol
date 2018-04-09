pragma solidity ^0.4.17;

contract Remittance {

    address public owner;
    bool public paused = false;

    struct RemittanceInstance {
        uint256 amount;
        uint256 deadline;
        address issuer;
        address recipient;
        bool claimed;
    }
    mapping(bytes32 => RemittanceInstance) public remittances;

    event RemittanceCreated(address indexed creator, address indexed recipient, uint256 amount, bytes32 puzzle, uint256 deadline);
    event RemittanceClaimed(address indexed claimer, bytes32 puzzle);
    event RemittanceReclaimed(bytes32 puzzle);

    function Remittance() public {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    modifier isNotPaused() {
        require(paused == false);
        _;
    }

    function createRemittance(bytes32 puzzle, uint256 deadline, address recipient) isNotPaused payable public {
        require(msg.value != 0);
        require(deadline < 40320);
        require(remittances[puzzle].amount == 0);
        uint256 actualDeadline = block.number+deadline;

        remittances[puzzle] = RemittanceInstance(msg.value, actualDeadline, msg.sender, recipient, false);
        RemittanceCreated(msg.sender, recipient, msg.value, puzzle, actualDeadline);
    }

    function claimRemittance(string password) isNotPaused public {
        bytes32 solution = keccak256(password, msg.sender);
        RemittanceInstance storage remittance = remittances[solution];
        assert(remittance.recipient == msg.sender);
        assert(remittance.claimed == false);

        uint256 amount = remittance.amount;
        assert(amount != 0);

        remittance.claimed = true;
        RemittanceClaimed(msg.sender, solution);
        msg.sender.transfer(amount);
    }

    function reclaimRemittance(bytes32 puzzle) isNotPaused public {
        RemittanceInstance storage remittance = remittances[puzzle];
        require(remittance.issuer == msg.sender);
        require(block.number > remittance.deadline);
        require(remittance.claimed == false);

        uint256 amount = remittance.amount;
        assert(amount != 0);

        remittance.claimed = true;
        RemittanceReclaimed(puzzle);
        msg.sender.transfer(amount);
    }

    function pause() onlyOwner isNotPaused public {
        paused = true;
    }

    function resume() onlyOwner public {
        paused = false;
    }

}