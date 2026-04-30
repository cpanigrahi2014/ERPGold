package com.nexus.admin.application.dto;

import com.nexus.admin.domain.model.Customer;

import java.util.UUID;

public record CustomerResponse(
    UUID id, String customerNumber, String name, String company,
    String gstin, String bisNumber, String pan,
    String phone, String email,
    String addressLine1, String addressLine2,
    String city, String state, String postalCode,
    Customer.CustomerType type, boolean active
) {
    public static CustomerResponse from(Customer c) {
        return new CustomerResponse(
            c.getId(), c.getCustomerNumber(), c.getName(), c.getCompany(),
            c.getGstin(), c.getBisNumber(), c.getPan(),
            c.getPhone(), c.getEmail(),
            c.getAddressLine1(), c.getAddressLine2(),
            c.getCity(), c.getState(), c.getPostalCode(),
            c.getType(), c.isActive()
        );
    }
}
