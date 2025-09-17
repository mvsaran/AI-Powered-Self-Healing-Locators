Feature: Amazon Search
  As a user on Amazon.com
  I want to search for products
  So I can find what I want to buy

  Scenario: Search for Apple MacBook Air
    Given I am on Amazon.com homepage
    When I search for "Apple 2025 MacBook Air"
    Then I should see product results for "MacBook Air"
    And the price should be displayed correctly