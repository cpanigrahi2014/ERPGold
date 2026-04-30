package com.nexus.billing.domain.repository;

import com.nexus.billing.domain.model.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {
    List<Invoice> findByTenantIdOrderByInvoiceDateDesc(UUID tenantId);
    List<Invoice> findByTenantIdAndStatusOrderByInvoiceDateDesc(UUID tenantId, Invoice.Status status);
    List<Invoice> findByTenantIdAndCustomerIdOrderByInvoiceDateDesc(UUID tenantId, UUID customerId);
}
