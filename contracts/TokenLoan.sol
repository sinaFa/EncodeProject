// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IMyERC20Token {
    function mint(address to, uint256 amount) external;

    function burnFrom(address to, uint256 amount) external;

    function transferFrom(address from, address to, uint256 amount) external;

    function balanceOf(address account) external returns (uint256);
}

/**
 * This contains a placement
 */
struct Placement {
    /** This is the placement creation date */
    uint256 startingDate;
    /** This is the amount of staked tokens */
    uint256 amount;
}

/**
 * PlacementResults is made of interests and penalties
 */
struct PlacementResults {
    /**
     * This is effective profits, independant of any penalty, calulated from
     * (1) the ratio of the contract
     * (2) the placement duration
     * This must be divided by 1_000_000
     */
    uint256 profits;
    /**
     * This is the penalties ratio, depending on contract duration
     * This is in 100th
     */
    uint256 penaltyRatio;
    /**
     * This is the penalties = yields * penaltyRatio / 100;
     * This must be substracted from profits
     * This must be divided by 1_000_000
     */
    uint256 penalties;
}

/**
 * This contract permits to gain interest on locked token
 * Interest are provided each 2 weeks
 */
contract TokenLoan {
    uint256 public constant PERIOD_LENGTH = 2 weeks;
    uint256 public constant PERIODS_PER_YEAR = 24;

    uint256 public constant INITIALDATE = 1671223621; // GMT: Friday 16 December 2022 20:47:01

    uint256 public interestsRatio; // this is percentage
    uint256 public feesRatio; // this is percentage
    uint256 public tokenPrice;
    IMyERC20Token public placementToken;
    mapping(address => Placement) public placements;
    mapping(address => bool) public users;
    address owner;

    constructor(
        uint256 _interestsRatio,
        uint256 _feesRatio,
        uint256 _price,
        address _token
    ) {
        owner = msg.sender;
        interestsRatio = _interestsRatio;
        feesRatio = _feesRatio;
        tokenPrice = _price;
        placementToken = IMyERC20Token(_token);
    }

    function purchaseTokens() external payable {
        users[msg.sender] = true;
        placementToken.mint(msg.sender, msg.value / tokenPrice);
    }

    function burnTokens(uint256 amount) external {
        require(users[msg.sender] == true);
        placementToken.burnFrom(msg.sender, amount);
        payable(msg.sender).transfer(amount * tokenPrice);
    }

    function getStartDate()
        public
        view
        returns (uint256 startDate) {
        
        startDate = placements[msg.sender].startingDate;
    }
    function getStakedAmount()
        public
        view
        returns (uint256 startDate) {
        
        startDate = placements[msg.sender].amount;
    }
    
    /**
     * This calculates investment results, according to past time
     * Interests = 0, if investement duration < PERIOD_LENGTH
     * This pubilc function permits users to make simulations
     * 
     * This is called by _computResults() to determine investment results
     * Hence end users can verify the computation
     * 
     * @return results
     */
    function calculateResults(uint256 periods)
        public
        view
        returns (PlacementResults memory results)
    {
        require(
            placements[msg.sender].amount > 0 &&
                placements[msg.sender].startingDate > INITIALDATE
        );

        results = PlacementResults(0, 0, 0);

        if (periods <= 24) results.penaltyRatio = 1;
        if (periods <= 12) results.penaltyRatio = 2;
        if (periods <= 6) results.penaltyRatio = 3;
        if (periods <= 2) results.penaltyRatio = 5;

        results.profits = 
            1_000_000 * placements[msg.sender].amount * periods * interestsRatio / 100 /
            PERIODS_PER_YEAR;

        if (periods < 2) results.profits = 0;

        results.penalties = (results.profits * results.penaltyRatio) / 100;
    }

    /**
     * This compute investment results, according to past time
     * Interests = 0, if investement duration < PERIOD_LENGTH
     * @return results
     */
    function _computeResults()
        internal
        view
        returns (PlacementResults memory results)
    {
        require(
            placements[msg.sender].amount > 0 &&
                placements[msg.sender].startingDate > INITIALDATE
        );
        uint256 currentDate = block.timestamp;
        uint256 startDate = placements[msg.sender].startingDate;
        uint256 duration = currentDate - startDate;
        uint256 periods = duration / PERIOD_LENGTH;

        return calculateResults(periods);
    }
    
    /**
     * This stakes (locks) tokens
     * @param _amount is the amount of tokens the caller wants to stake
     */
    function stakeTokens(uint256 _amount) external {
        placementToken.burnFrom(msg.sender, _amount);
        placementToken.mint(address(this), _amount);
        uint256 startDate = block.timestamp;
        placements[msg.sender] = Placement({
            startingDate: startDate,
            amount: _amount
        });
    }

    /**
     * This unstakes (unlocks) tokens.
     * This retrieves placement results, gives interests to caller and substract penalties, if any.
     * This sends penalties, if any, to this contract owner
     * @param _amount is the amount of tokens the caller wants to unstake
     */
    function unstakeTokens(uint256 _amount) external {
        require(placements[msg.sender].amount - _amount > 0);

        PlacementResults memory results = _computeResults();

        // fees are calculated on results, before penalties
        uint256 fees = (results.profits * feesRatio) / 100;
        uint256 profits = _amount + results.profits - fees - results.penalties;

        require(profits > 0);

        placementToken.mint(address(this), fees + results.penalties); // this is where we may earn money
        placementToken.mint(msg.sender, profits);

        uint256 startDate = block.timestamp;
        uint256 remaining = placements[msg.sender].amount - _amount;
        placements[msg.sender] = Placement({
            startingDate: startDate,
            amount: remaining
        });
    }
}
