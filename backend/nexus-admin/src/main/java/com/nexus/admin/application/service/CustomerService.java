package com.nexus.admin.application.service;

import com.nexus.admin.application.dto.CustomerRequest;
import com.nexus.admin.application.dto.CustomerResponse;
import com.nexus.admin.application.support.CurrentContext;
import com.nexus.admin.domain.model.Customer;
import com.nexus.admin.domain.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class CustomerService {

    private final CustomerRepository repo;
    private final CurrentContext ctx;

    public CustomerResponse create(CustomerRequest r) {
        UUID tenant = ctx.tenantId();
        repo.findByTenantIdAndCustomerNumber(tenant, r.customerNumber()).ifPresent(c -> {
            throw new IllegalArgumentException("Customer number already exists: " + r.customerNumber());
        });
        Customer c = Customer.builder()
            .customerNumber(r.customerNumber()).name(r.name()).company(r.company())
            .gstin(r.gstin()).bisNumber(r.bisNumber()).pan(r.pan())
            .phone(r.phone()).email(r.email())
            .addressLine1(r.addressLine1()).addressLine2(r.addressLine2())
            .city(r.city()).state(r.state()).postalCode(r.postalCode())
            .type(r.type() != null ? r.type() : Customer.CustomerType.JEWELLER)
            .build();
        c.setTenantId(tenant);
        c.setCreatedBy(ctx.userId());
        c.setUpdatedBy(ctx.userId());
        return CustomerResponse.from(repo.save(c));
    }

    @Transactional(readOnly = true)
    public List<CustomerResponse> list() {
        return repo.findAll().stream().map(CustomerResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public CustomerResponse get(UUID id) {
        return repo.findById(id).map(CustomerResponse::from)
            .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + id));
    }

    public CustomerResponse update(UUID id, CustomerRequest r) {
        Customer c = repo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + id));
        c.setName(r.name()); c.setCompany(r.company());
        c.setGstin(r.gstin()); c.setBisNumber(r.bisNumber()); c.setPan(r.pan());
        c.setPhone(r.phone()); c.setEmail(r.email());
        c.setAddressLine1(r.addressLine1()); c.setAddressLine2(r.addressLine2());
        c.setCity(r.city()); c.setState(r.state()); c.setPostalCode(r.postalCode());
        if (r.type() != null) c.setType(r.type());
        c.setUpdatedBy(ctx.userId());
        return CustomerResponse.from(c);
    }

    public void delete(UUID id) {
        Customer c = repo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + id));
        c.softDelete(ctx.userId());
    }
}
