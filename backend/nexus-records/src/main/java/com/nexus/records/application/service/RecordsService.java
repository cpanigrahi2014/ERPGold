package com.nexus.records.application.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.records.application.dto.RecordsDtos.*;
import com.nexus.records.application.support.CurrentContext;
import com.nexus.records.domain.model.*;
import com.nexus.records.domain.repository.*;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecordsService {

    private final DayBookEntryRepository dayBook;
    private final AuditLogRepository auditLogs;
    private final RegisterEntryRepository registers;
    private final BusinessRecordRepository businessRecords;
    private final CurrentContext ctx;
    private static final ObjectMapper OM = new ObjectMapper();

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

    @Transactional
    public ExportArtifact exportBusinessRecords(BusinessRecordExportRequest r) {
        LocalDate from = r.fromDate();
        LocalDate to = r.toDate();
        if (to.isBefore(from)) throw new IllegalArgumentException("toDate must be >= fromDate");

        UUID t = ctx.tenantId();
        String branchCode = r.branchCode().trim().toUpperCase();

        List<BusinessRecord> candidates = businessRecords.findByTenantIdOrderByYearDescMonthDescCreatedAtDesc(t)
            .stream()
            .filter(b -> branchCode.equalsIgnoreCase(b.getBranchCode()))
            .filter(b -> overlapsMonthRange(b.getYear(), b.getMonth(), from, to))
            .toList();

        List<Map<String, Object>> cash = new ArrayList<>();
        List<Map<String, Object>> expense = new ArrayList<>();
        List<Map<String, Object>> huid = new ArrayList<>();
        List<Map<String, Object>> refinery = new ArrayList<>();
        List<Map<String, Object>> bank = new ArrayList<>();
        List<Map<String, Object>> marketDue = new ArrayList<>();
        List<Map<String, Object>> corporate = new ArrayList<>();

        for (BusinessRecord b : candidates) {
            cash.addAll(filterByDate(parseRows(b.getCashRows()), from, to));
            expense.addAll(filterByDate(parseRows(b.getExpenseRows()), from, to));
            huid.addAll(filterByDate(parseRows(b.getHuidRows()), from, to));
            refinery.addAll(filterByDate(parseRows(b.getRefineryRows()), from, to));
            bank.addAll(filterByDate(parseRows(b.getBankRows()), from, to));
            marketDue.addAll(parseRows(b.getMarketDueRows()));
            corporate.addAll(parseRows(b.getCorporateExpenseRows()));
        }

        Map<String, Object> basic = new LinkedHashMap<>();
        basic.put("branchCode", branchCode);
        basic.put("fromDate", from.toString());
        basic.put("toDate", to.toString());
        basic.put("recordCount", candidates.size());
        basic.put("cashRows", cash.size());
        basic.put("expenseRows", expense.size());
        basic.put("huidRows", huid.size());
        basic.put("refineryRows", refinery.size());

        byte[] workbookBytes = buildWorkbook(basic, cash, expense, refinery, bank, huid, marketDue, corporate);

        BusinessRecord target = candidates.stream()
            .sorted(Comparator.comparingInt(BusinessRecord::getYear).reversed().thenComparingInt(BusinessRecord::getMonth).reversed())
            .findFirst()
            .orElse(null);

        String fileName = String.format("records_%s_%s_%s.xlsx", branchCode, from, to);
        UUID recordId = null;
        if (target != null) {
            target.setExportFileName(fileName);
            target.setExportContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            target.setExportAttachment(workbookBytes);
            target.setExportGeneratedAt(java.time.Instant.now());
            target.setUpdatedBy(ctx.userId());
            businessRecords.save(target);
            recordId = target.getId();
        }

        return new ExportArtifact(recordId, fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", workbookBytes);
    }

    public ExportArtifact downloadBusinessRecordExport(UUID id) {
        BusinessRecord b = businessRecords.findById(id)
            .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Business record not found"));
        if (b.getExportAttachment() == null || b.getExportAttachment().length == 0) {
            throw new jakarta.persistence.EntityNotFoundException("No export attachment found for this record");
        }
        String fileName = b.getExportFileName() == null ? "records_export.xlsx" : b.getExportFileName();
        String contentType = b.getExportContentType() == null
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : b.getExportContentType();
        return new ExportArtifact(b.getId(), fileName, contentType, b.getExportAttachment());
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
            b.getExportFileName(),
            b.getExportContentType(),
            b.getExportAttachment() != null && b.getExportAttachment().length > 0,
            b.getExportGeneratedAt(),
            b.getCreatedAt(),
            b.getUpdatedAt()
        );
    }

    private boolean overlapsMonthRange(int year, int month, LocalDate from, LocalDate to) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate first = ym.atDay(1);
        LocalDate last = ym.atEndOfMonth();
        return !last.isBefore(from) && !first.isAfter(to);
    }

    private List<Map<String, Object>> parseRows(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<Map<String, Object>> rows = OM.readValue(json, new TypeReference<>() {});
            return rows == null ? List.of() : rows;
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<Map<String, Object>> filterByDate(List<Map<String, Object>> rows, LocalDate from, LocalDate to) {
        return rows.stream().filter(r -> {
            Object dv = r.get("date");
            if (dv == null) return false;
            try {
                LocalDate d = LocalDate.parse(String.valueOf(dv));
                return !d.isBefore(from) && !d.isAfter(to);
            } catch (DateTimeParseException e) {
                return false;
            }
        }).toList();
    }

    private byte[] buildWorkbook(
        Map<String, Object> basic,
        List<Map<String, Object>> cash,
        List<Map<String, Object>> expense,
        List<Map<String, Object>> refinery,
        List<Map<String, Object>> bank,
        List<Map<String, Object>> huid,
        List<Map<String, Object>> marketDue,
        List<Map<String, Object>> corporate
    ) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            writeSheet(wb.createSheet("Basic Info"), List.of("key", "value"),
                basic.entrySet().stream().map(e -> List.of(e.getKey(), String.valueOf(e.getValue()))).toList());
            writeMapSheet(wb.createSheet("Cash Part"), cash);
            writeMapSheet(wb.createSheet("Expenses Details"), expense);
            writeMapSheet(wb.createSheet("Refinery Part"), refinery);
            writeMapSheet(wb.createSheet("Bank Sheet"), bank);
            writeMapSheet(wb.createSheet("HUID Billing Details"), huid);
            writeMapSheet(wb.createSheet("Market Due List"), marketDue);
            writeMapSheet(wb.createSheet("Corporate Expenses"), corporate);
            wb.write(bos);
            return bos.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to build export workbook", e);
        }
    }

    private void writeMapSheet(Sheet sheet, List<Map<String, Object>> rows) {
        List<String> headers = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            for (String k : r.keySet()) {
                if (!headers.contains(k)) headers.add(k);
            }
        }
        if (headers.isEmpty()) headers = List.of("info");

        List<List<String>> data = new ArrayList<>();
        if (rows.isEmpty()) {
            data.add(List.of("No records for selected filter"));
        } else {
            for (Map<String, Object> r : rows) {
                List<String> line = new ArrayList<>();
                for (String h : headers) line.add(String.valueOf(r.get(h) == null ? "" : r.get(h)));
                data.add(line);
            }
        }
        writeSheet(sheet, headers, data);
    }

    private void writeSheet(Sheet sheet, List<String> headers, List<List<String>> data) {
        Row h = sheet.createRow(0);
        for (int i = 0; i < headers.size(); i++) {
            Cell c = h.createCell(i);
            c.setCellValue(headers.get(i));
        }
        int rowIdx = 1;
        for (List<String> line : data) {
            Row r = sheet.createRow(rowIdx++);
            for (int i = 0; i < line.size(); i++) r.createCell(i).setCellValue(line.get(i));
        }
        for (int i = 0; i < headers.size(); i++) sheet.autoSizeColumn(i);
    }

    public record ExportArtifact(UUID recordId, String fileName, String contentType, byte[] bytes) {}
}
