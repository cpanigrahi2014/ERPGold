package com.nexus.billing.domain.repository;

import com.nexus.billing.domain.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    List<Payment> findByInvoiceIdOrderByPaymentDateAsc(UUID invoiceId);
    List<Payment> findByInvoiceIdInOrderByPaymentDateAsc(java.util.Collection<UUID> invoiceIds);
}
