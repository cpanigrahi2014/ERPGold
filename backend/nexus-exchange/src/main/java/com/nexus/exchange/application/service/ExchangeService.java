package com.nexus.exchange.application.service;

import com.nexus.exchange.application.dto.ExchangeDtos.*;
import com.nexus.exchange.application.support.CurrentContext;
import com.nexus.exchange.domain.model.*;
import com.nexus.exchange.domain.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class ExchangeService {

    private final ExchangeTxnRepository  txns;
    private final ExchangeItemRepository items;
    private final ExchangeReturnRepository returns;
    private final CurrentContext ctx;

    private static final DateTimeFormatter DF = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final BigDecimal THOUSAND = new BigDecimal("1000");

    // ---------- Txns ----------
    @Transactional
    public TxnResponse createTxn(TxnRequest r) {
        ExchangeTxn t = ExchangeTxn.builder()
            .txnNumber(r.txnNumber() == null || r.txnNumber().isBlank()
                ? "EX-" + LocalDate.now().format(DF) + "-" + ThreadLocalRandom.current().nextInt(10000, 99999)
                : r.txnNumber())
            .branchId(r.branchId()).customerId(r.customerId())
            .exchangeDate(r.exchangeDate() == null ? LocalDate.now() : r.exchangeDate())
            .metal(r.metal() == null ? ExchangeTxn.Metal.GOLD : r.metal())
            .valuationRate(r.valuationRate())
            .settlementType(r.settlementType() == null ? ExchangeTxn.SettlementType.CASH : r.settlementType())
            .remarks(r.remarks())
            .build();
        stamp(t);
        return toTxn(txns.save(t));
    }

    public List<TxnResponse> listTxns(ExchangeTxn.Status status) {
        UUID t = ctx.tenantId();
        var list = (status == null)
            ? txns.findByTenantIdOrderByExchangeDateDesc(t)
            : txns.findByTenantIdAndStatusOrderByExchangeDateDesc(t, status);
        return list.stream().map(this::toTxn).toList();
    }

    public TxnResponse getTxn(UUID id) {
        return toTxn(txns.findById(id).orElseThrow(() -> new EntityNotFoundException("Transaction not found")));
    }

    @Transactional
    public TxnResponse updateTxn(UUID id, TxnUpdateRequest r) {
        ExchangeTxn t = txns.findById(id).orElseThrow(() -> new EntityNotFoundException("Transaction not found"));
        if (r.valuationRate() != null) t.setValuationRate(r.valuationRate());
        if (r.settlementType() != null) t.setSettlementType(r.settlementType());
        if (r.remarks() != null) t.setRemarks(r.remarks());
        t.setUpdatedBy(ctx.userId());
        return toTxn(txns.save(t));
    }

    @Transactional
    public TxnResponse updateStatus(UUID id, ExchangeTxn.Status status) {
        ExchangeTxn t = txns.findById(id).orElseThrow(() -> new EntityNotFoundException("Transaction not found"));
        t.setStatus(status);
        if (status == ExchangeTxn.Status.POSTED && t.getPostedDate() == null) {
            t.setPostedDate(LocalDate.now());
        }
        t.setUpdatedBy(ctx.userId());
        return toTxn(txns.save(t));
    }

    // ---------- Items ----------
    @Transactional
    public ItemResponse addItem(ItemRequest r) {
        ExchangeTxn t = txns.findById(r.txnId()).orElseThrow(() -> new EntityNotFoundException("Transaction not found"));
        if (t.getStatus() != ExchangeTxn.Status.DRAFT) {
            throw new IllegalStateException("Cannot modify items on a " + t.getStatus() + " transaction");
        }
        BigDecimal pure  = (r.fineness() != null) ? r.grossWeight().multiply(r.fineness()).divide(THOUSAND, 4, RoundingMode.HALF_UP) : null;
        // Resolve effective rate: explicit per-line rate wins, else txn-level valuation rate.
        BigDecimal rate = r.ratePerGram() != null ? r.ratePerGram() : t.getValuationRate();
        BigDecimal making = r.makingCharges() != null ? r.makingCharges() : BigDecimal.ZERO;
        BigDecimal lineValue;
        if (r.side() == ExchangeItem.Side.OLD) {
            // Old items valued on PURE weight × rate (no making charges credited).
            BigDecimal basis = pure != null ? pure : r.grossWeight();
            lineValue = (rate != null) ? basis.multiply(rate).setScale(2, RoundingMode.HALF_UP) : null;
        } else {
            // New items priced on GROSS × rate + making charges.
            BigDecimal metalCost = (rate != null) ? r.grossWeight().multiply(rate).setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            lineValue = metalCost.add(making);
        }
        ExchangeItem it = ExchangeItem.builder()
            .txnId(r.txnId()).side(r.side())
            .itemDesc(r.itemDesc()).hsnCode(r.hsnCode())
            .grossWeight(r.grossWeight()).fineness(r.fineness()).pureWeight(pure)
            .ratePerGram(rate).makingCharges(making).lineValue(lineValue)
            .lotId(r.lotId()).remarks(r.remarks())
            .build();
        stamp(it);
        ExchangeItem saved = items.save(it);
        recompute(t);
        t.setUpdatedBy(ctx.userId()); txns.save(t);
        return toItem(saved);
    }

    public List<ItemResponse> listItems(UUID txnId) {
        return items.findByTxnIdOrderByCreatedAtAsc(txnId).stream().map(this::toItem).toList();
    }

    // ---------- Returns ----------
    public List<ReturnResponse> listReturns() {
        return returns.findByTenantIdOrderByCreatedAtDesc(ctx.tenantId()).stream().map(this::toReturn).toList();
    }

    @Transactional
    public ReturnResponse createReturn(ReturnRequest r) {
        ExchangeTxn t = txns.findById(r.txnId()).orElseThrow(() -> new EntityNotFoundException("Transaction not found"));
        if (t.getStatus() != ExchangeTxn.Status.POSTED) {
            throw new IllegalStateException("Only posted transactions can be returned");
        }
        ExchangeReturn er = ExchangeReturn.builder()
            .txnId(r.txnId())
            .reason(r.reason())
            .status(ExchangeReturn.Status.PENDING)
            .build();
        stamp(er);
        return toReturn(returns.save(er));
    }

    @Transactional
    public ReturnResponse updateReturnStatus(UUID id, ExchangeReturn.Status status) {
        ExchangeReturn er = returns.findById(id).orElseThrow(() -> new EntityNotFoundException("Return not found"));
        er.setStatus(status);
        er.setUpdatedBy(ctx.userId());
        return toReturn(returns.save(er));
    }

    // ---------- Recompute totals ----------
    private void recompute(ExchangeTxn t) {
        var olds = items.findByTxnIdAndSideOrderByCreatedAtAsc(t.getId(), ExchangeItem.Side.OLD);
        var news = items.findByTxnIdAndSideOrderByCreatedAtAsc(t.getId(), ExchangeItem.Side.NEW);
        t.setOldGross(sumGross(olds));  t.setOldPure(sumPure(olds));  t.setOldValue(sumValue(olds));
        t.setNewGross(sumGross(news));  t.setNewPure(sumPure(news));  t.setNewValue(sumValue(news));
        BigDecimal making = news.stream()
            .map(ExchangeItem::getMakingCharges)
            .filter(java.util.Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        t.setMakingCharges(making);
        t.setBalancePayable(t.getNewValue().subtract(t.getOldValue()));
    }
    private static BigDecimal sumGross(List<ExchangeItem> xs) {
        return xs.stream().map(ExchangeItem::getGrossWeight).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
    private static BigDecimal sumPure(List<ExchangeItem> xs) {
        return xs.stream().map(ExchangeItem::getPureWeight).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
    private static BigDecimal sumValue(List<ExchangeItem> xs) {
        return xs.stream().map(ExchangeItem::getLineValue).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // ---------- helpers ----------
    private void stamp(com.nexus.common.domain.BaseEntity e) {
        UUID t = ctx.tenantId(); UUID u = ctx.userId();
        if (e.getTenantId() == null) e.setTenantId(t);
        if (e.getCreatedBy() == null) e.setCreatedBy(u);
        e.setUpdatedBy(u);
    }
    private TxnResponse toTxn(ExchangeTxn t) {
        return new TxnResponse(t.getId(), t.getTxnNumber(), t.getBranchId(), t.getCustomerId(),
            t.getExchangeDate(), t.getPostedDate(), t.getMetal(), t.getValuationRate(),
            t.getOldGross(), t.getOldPure(), t.getOldValue(),
            t.getNewGross(), t.getNewPure(), t.getNewValue(),
            t.getMakingCharges(), t.getBalancePayable(),
            t.getSettlementType(), t.getStatus(), t.getRemarks());
    }
    private ItemResponse toItem(ExchangeItem i) {
        return new ItemResponse(i.getId(), i.getTxnId(), i.getSide(),
            i.getItemDesc(), i.getHsnCode(),
            i.getGrossWeight(), i.getFineness(), i.getPureWeight(),
            i.getRatePerGram(), i.getMakingCharges(), i.getLineValue(),
            i.getLotId(), i.getRemarks());
    }
    private ReturnResponse toReturn(ExchangeReturn r) {
        String txnNumber = txns.findById(r.getTxnId()).map(ExchangeTxn::getTxnNumber).orElse(null);
        return new ReturnResponse(r.getId(), r.getTxnId(), txnNumber, r.getReason(), r.getStatus(), r.getCreatedAt());
    }
}
