package com.nexus.admin.application.dto;

import com.nexus.admin.domain.model.Customer;
import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record CustomerRequest(
    @NotBlank String customerNumber,
    @NotBlank String name,
    String company,
    String gstin, String bisNumber, String pan,
    String phone, String email,
    String addressLine1, String addressLine2,
    String city, String state, String postalCode,
    Customer.CustomerType type
) {}
