package com.nexus.records.application.service;

import com.nexus.records.application.dto.RecordsDtos.*;
import com.nexus.records.application.support.CurrentContext;
import com.nexus.records.domain.model.*;
import com.nexus.records.domain.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecordsService {

    private final DayBookEntryRepository dayBook;
    private final AuditLogRepository auditLogs;
    private final RegisterEntryRepository registers;
    private final BusinessRecordRepository businessRecords;
    private final CurrentContext ctx;

    private static final BigDecimal Z = BigDecimal.ZERO;

    // ---------- Day Book ----------
    @Transactional
    public DayBookResponse addDayBook(DayBookRequest r) {
        DayBookEntry e = DayBookEntry.builder()
            .entryDate(r.entryDate() == null ? LocalDate.now() : r.entryDate())
            .branchId(r.branchId()).module(r.module()).txnType(r.txnType())
            .referenceNo(r.referenceNo()).referenceId(r.referenceId())
            .partyId(r.partyId()).partyName(r.partyName()).narration(r.narration())
            .metalInG(r.metalInG()).metalOutG(r.metalOutG())
            .amountIn(r.amountIn()).amountOut(r.amountOut())
            .build();
        stamp(e);
        return toDayBook(dayBook.save(e));
    }

    public List<DayBookResponse> listDayBook(LocalDate from, LocalDate to, UUID branchId, DayBookEntry.Module module) {
        UUID t = ctx.tenantId();
        LocalDate f = from == null ? LocalDate.now().minusDays(30) : from;
        LocalDate u = to == null ? LocalDate.now() : to;
        List<DayBookEntry> list;
        if (branchId != null) list = dayBook.findByTenantIdAndBranchIdAndEntryDateBetweenOrderByEntryDateDescCreatedAtDesc(t, branchId, f, u);
        else if (module != null) list = dayBook.findByTenantIdAndModuleOrderByEntryDateDescCreatedAtDesc(t, module);
        else list = dayBook.findByTenantIdAndEntryDateBetweenOrderByEntryDateDescCreatedAtDesc(t, f, u);
        return list.stream().map(this::toDayBook).toList();
    }

    public DaySummary daySummary(LocalDate date) {
        UUID t = ctx.tenantId();
        LocalDate d = date == null ? LocalDate.now() : date;
        List<DayBookEntry> list = dayBook.findByTenantIdAndEntryDateOrderByCreatedAtAsc(t, d);
        BigDecimal mi = list.stream().map(DayBookEntry::getMetalInG ).filter(java.util.Objects::nonNull).reduce(Z, BigDecimal::add);
        BigDecimal mo = list.stream().map(DayBookEntry::getMetalOutG).filter(java.util.Objects::nonNull).reduce(Z, BigDecimal::add);
        BigDecimal ai = list.stream().map(DayBookEntry::getAmountIn ).filter(java.util.Objects::nonNull).reduce(Z, BigDecimal::add);
        BigDecimal ao = list.stream().map(DayBookEntry::getAmountOut).filter(java.util.Objects::nonNull).reduce(Z, BigDecimal::add);
        return new DaySummary(d, mi, mo, ai, ao, list.size());
    }

    // ---------- Audit ----------
    @Transactional
    public AuditResponse addAudit(AuditRequest r) {
        AuditLog a = AuditLog.builder()
            .occurredAt(r.occurredAt() == null ? OffsetDateTime.now() : r.occurredAt())
            .module(r.module()).action(r.action())
            .entityType(r.entityType()).entityId(r.entityId())
            .actorId(r.actorId() == null ? ctx.userId() : r.actorId())
            .actorName(r.actorName()).ipAddress(r.ipAddress())
            .summary(r.summary()).beforeJson(r.beforeJson()).afterJson(r.afterJson())
            .build();
        stamp(a);
        return toAudit(auditLogs.save(a));
    }

    public List<AuditResponse> listAudit(DayBookEntry.Module module, OffsetDateTime from, OffsetDateTime to,
                                        String entityType, UUID entityId) {
        UUID t = ctx.tenantId();
        List<AuditLog> list;
        if (entityType != null && entityId != null)
            list = auditLogs.findByTenantIdAndEntityTypeAndEntityIdOrderByOccurredAtDesc(t, entityType, entityId);
        else if (module != null)
            list = auditLogs.findByTenantIdAndModuleOrderByOccurredAtDesc(t, module);
        else if (from != null && to != null)
            list = auditLogs.findByTenantIdAndOccurredAtBetweenOrderByOccurredAtDesc(t, from, to);
        else
            list = auditLogs.findTop200ByTenantIdOrderByOccurredAtDesc(t);
        return list.stream().map(this::toAudit).toList();
    }

    // ---------- Registers ----------
    @Transactional
    public RegisterResponse addRegister(RegisterRequest r) {
        UUID t = ctx.tenantId();
        long nextSerial = registers.findTopByTenantIdAndRegisterTypeOrderBySerialNoDesc(t, r.registerType())
            .map(p -> p.getSerialNo() + 1).orElse(1L);
        var prior = registers.findTopByTenantIdAndRegisterTypeOrderBySerialNoDesc(t, r.registerType());
        BigDecimal prevBal = prior.map(RegisterEntry::getBalance).orElse(Z);
        if (prevBal == null) prevBal = Z;
        BigDecimal qIn  = r.qtyIn()  == null ? Z : r.qtyIn();
        BigDecimal qOut = r.qtyOut() == null ? Z : r.qtyOut();
        BigDecimal balance = prevBal.add(qIn).subtract(qOut);

        RegisterEntry e = RegisterEntry.builder()
            .registerType(r.registerType())
            .entryDate(r.entryDate() == null ? LocalDate.now() : r.entryDate())
            .serialNo(nextSerial)
            .branchId(r.branchId()).metal(r.metal()).purityLabel(r.purityLabel())
            .particulars(r.particulars()).voucherNo(r.voucherNo()).partyName(r.partyName())
            .qtyIn(qIn).qtyOut(qOut).balance(balance)
            .valueIn(r.valueIn()).valueOut(r.valueOut())
            .build();
        stamp(e);
        return toRegister(registers.save(e));
    }

    public List<RegisterResponse> listRegister(RegisterEntry.RegisterType type, LocalDate from, LocalDate to) {
        UUID t = ctx.tenantId();
        List<RegisterEntry> list = (from != null && to != null)
            ? registers.findByTenantIdAndRegisterTypeAndEntryDateBetweenOrderBySerialNoAsc(t, type, from, to)
            : registers.findByTenantIdAndRegisterTypeOrderBySerialNoAsc(t, type);
        return list.stream().map(this::toRegister).toList();
    }

    // ---------- Business Records ----------
    @Transactional
    public BusinessRecordResponse createBusinessRecord(BusinessRecordCreateRequest r) {
        UUID t = ctx.tenantId();
        businessRecords.findByTenantIdAndBranchRefAndMonthAndYear(t, r.branchRef(), r.month(), r.year())
            .ifPresent(x -> { throw new IllegalStateException("Duplicate business record for branch/month/year"); });

        BusinessRecord b = BusinessRecord.builder()
            .branchRef(r.branchRef())
            .branchCode(r.branchCode())
            .branchName(r.branchName())
            .month(r.month())
            .year(r.year())
            .name(r.name())
            .build();
        stamp(b);
        return toBusinessRecord(businessRecords.save(b));
    }

    public List<BusinessRecordResponse> listBusinessRecords() {
        UUID t = ctx.tenantId();
        return businessRecords.findByTenantIdOrderByYearDescMonthDescCreatedAtDesc(t)
            .stream().map(this::toBusinessRecord).toList();
    }

    @Transactional
    public BusinessRecordResponse updateBusinessRecord(UUID id, BusinessRecordUpdateRequest r) {
        BusinessRecord b = businessRecords.findById(id)
            .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Business record not found"));

        if (r.name() != null) b.setName(r.name());
        if (r.cashRows() != null) b.setCashRows(r.cashRows());
        if (r.expenseRows() != null) b.setExpenseRows(r.expenseRows());
        if (r.huidRows() != null) b.setHuidRows(r.huidRows());
        if (r.refineryRows() != null) b.setRefineryRows(r.refineryRows());
        if (r.bankRows() != null) b.setBankRows(r.bankRows());
        if (r.marketDueRows() != null) b.setMarketDueRows(r.marketDueRows());
        if (r.corporateExpenseRows() != null) b.setCorporateExpenseRows(r.corporateExpenseRows());

        b.setUpdatedBy(ctx.userId());
        return toBusinessRecord(businessRecords.save(b));
    }

    // ---------- helpers ----------
    private void stamp(com.nexus.common.domain.BaseEntity e) {
        UUID t = ctx.tenantId(); UUID u = ctx.userId();
        if (e.getTenantId() == null) e.setTenantId(t);
        if (e.getCreatedBy() == null) e.setCreatedBy(u);
        e.setUpdatedBy(u);
    }
    private DayBookResponse toDayBook(DayBookEntry e) {
        return new DayBookResponse(e.getId(), e.getEntryDate(), e.getBranchId(),
            e.getModule(), e.getTxnType(), e.getReferenceNo(), e.getReferenceId(),
            e.getPartyId(), e.getPartyName(), e.getNarration(),
            e.getMetalInG(), e.getMetalOutG(), e.getAmountIn(), e.getAmountOut());
    }
    private AuditResponse toAudit(AuditLog a) {
        return new AuditResponse(a.getId(), a.getOccurredAt(), a.getModule(), a.getAction(),
            a.getEntityType(), a.getEntityId(), a.getActorId(), a.getActorName(),
            a.getIpAddress(), a.getSummary(), a.getBeforeJson(), a.getAfterJson());
    }
    private RegisterResponse toRegister(RegisterEntry r) {
        return new RegisterResponse(r.getId(), r.getRegisterType(), r.getEntryDate(), r.getSerialNo(),
            r.getBranchId(), r.getMetal(), r.getPurityLabel(),
            r.getParticulars(), r.getVoucherNo(), r.getPartyName(),
            r.getQtyIn(), r.getQtyOut(), r.getBalance(), r.getValueIn(), r.getValueOut());
    }

    private BusinessRecordResponse toBusinessRecord(BusinessRecord b) {
        return new BusinessRecordResponse(
            b.getId(),
            b.getBranchRef(),
            b.getBranchCode(),
            b.getBranchName(),
            b.getMonth(),
            b.getYear(),
            b.getName(),
            b.getCashRows(),
            b.getExpenseRows(),
            b.getHuidRows(),
            b.getRefineryRows(),
            b.getBankRows(),
            b.getMarketDueRows(),
            b.getCorporateExpenseRows(),
            b.getCreatedAt(),
            b.getUpdatedAt()
        );
    }
}
