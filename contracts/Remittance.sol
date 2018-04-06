pragma solidity ^0.4.17;

contract Remittance {

    address public owner;
    bool public stopped = false;

    struct RemittanceInstance {
        uint256 amount;
        uint256 deadline;
        address issuer;
        address recipient;
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

    modifier isNotStopped() {
        require(stopped == false);
        _;
    }

    function createRemittance(bytes32 puzzle, uint256 deadline, address recipient) isNotStopped payable public {
        require(msg.value != 0);
        require(deadline < 40320);
        uint256 actualDeadline = block.number+deadline;
        remittances[puzzle] = RemittanceInstance(msg.value, actualDeadline, msg.sender, recipient);
        RemittanceCreated(msg.sender, recipient, msg.value, puzzle, actualDeadline);
    }

    function claimRemittance(string password) isNotStopped public {
        bytes32 solution = keccak256(password, msg.sender);
        RemittanceInstance storage remittance = remittances[solution];
        assert(remittance.recipient == msg.sender);

        uint256 amount = remittance.amount;
        assert(amount != 0);

        delete remittances[solution];
        msg.sender.transfer(amount);
        RemittanceClaimed(msg.sender, solution);
    }

    function reclaimRemittance(bytes32 puzzle) isNotStopped public {
        RemittanceInstance storage remittance = remittances[puzzle];
        require(remittance.issuer == msg.sender);
        require(block.number > remittance.deadline);

        uint256 amount = remittance.amount;
        assert(amount != 0);

        delete remittances[puzzle];
        msg.sender.transfer(amount);
        RemittanceReclaimed(puzzle);
    }

    function kill() onlyOwner isNotStopped public {
        stopped = true;
    }

}