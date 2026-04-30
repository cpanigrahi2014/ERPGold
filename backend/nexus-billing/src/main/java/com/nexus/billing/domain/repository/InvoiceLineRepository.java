package com.nexus.billing.domain.repository;

import com.nexus.billing.domain.model.InvoiceLine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InvoiceLineRepository extends JpaRepository<InvoiceLine, UUID> {
    List<InvoiceLine> findByInvoiceIdOrderByLineNoAsc(UUID invoiceId);
}
