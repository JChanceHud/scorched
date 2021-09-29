pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@statechannels/nitro-protocol/contracts/Outcome.sol";
import "@statechannels/nitro-protocol/contracts/interfaces/IForceMoveApp.sol";

contract ScathedEarth is IForceMoveApp {
  function validTransition(
    VariablePart calldata a,
    VariablePart calldata b,
    uint48 turnNumB,
    uint256 nParticipants
  ) public pure override returns (bool) {
    Outcome.OutcomeItem[] memory outcomeA =  abi.decode(a.outcome, (Outcome.OutcomeItem[]));
    Outcome.OutcomeItem[] memory outcomeB =  abi.decode(b.outcome, (Outcome.OutcomeItem[]));
    return true;
  }
}
