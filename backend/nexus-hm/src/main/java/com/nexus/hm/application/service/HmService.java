package com.nexus.hm.application.service;

import com.nexus.hm.application.dto.HmDtos.*;
import com.nexus.hm.application.support.CurrentContext;
import com.nexus.hm.domain.model.*;
import com.nexus.hm.domain.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class HmService {

    private final HmJobRepository jobs;
    private final HmMarkRepository marks;
    private final HmDispatchRepository dispatches;
    private final HmDeliveryOrderRepository deliveryOrders;
    private final HmDeliveryReturnRepository deliveryReturns;
    private final CurrentContext ctx;

    private static final DateTimeFormatter DF = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final char[] HUID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray(); // BIS-style alphanumeric, no I/O/0/1
    private static final SecureRandom RNG = new SecureRandom();

    // ---------- Jobs ----------
    @Transactional
    public JobResponse createJob(JobRequest r) {
        HmJob j = HmJob.builder()
            .jobNumber(r.jobNumber() == null || r.jobNumber().isBlank()
                ? "HM-" + LocalDate.now().format(DF) + "-" + ThreadLocalRandom.current().nextInt(10000, 99999)
                : r.jobNumber())
            .branchId(r.branchId()).jewellerId(r.jewellerId()).lotId(r.lotId()).kind(r.kind())
            .receivedDate(r.receivedDate() == null ? LocalDate.now() : r.receivedDate())
            .purityLabel(r.purityLabel()).declaredFineness(r.declaredFineness())
            .pieceCount(r.pieceCount() == null ? 1 : r.pieceCount())
            .grossWeight(r.grossWeight())
            .huidRequired(r.huidRequired() == null ? (r.kind() == HmJob.Kind.HUID) : r.huidRequired())
            .status(HmJob.Status.RECEIVED).ratePerPiece(r.ratePerPiece()).remarks(r.remarks())
            .workflowData(r.workflowData())
            .build();
        stamp(j);
        return toJob(jobs.save(j));
    }

    public List<JobResponse> listJobs(HmJob.Status status) {
        UUID t = ctx.tenantId();
        var list = (status == null)
            ? jobs.findByTenantIdOrderByReceivedDateDesc(t)
            : jobs.findByTenantIdAndStatusOrderByReceivedDateDesc(t, status);
        return list.stream().map(this::toJob).toList();
    }

    @Transactional
    public JobResponse updateStatus(UUID id, HmJob.Status status) {
        HmJob j = jobs.findById(id).orElseThrow(() -> new EntityNotFoundException("Job not found"));
        j.setStatus(status);
        if (status == HmJob.Status.MARKED) j.setMarkedDate(LocalDate.now());
        if (status == HmJob.Status.DISPATCHED) j.setDispatchedDate(LocalDate.now());
        j.setUpdatedBy(ctx.userId());
        return toJob(jobs.save(j));
    }

    @Transactional
    public JobResponse updateJob(UUID id, JobUpdateRequest r) {
        HmJob j = jobs.findById(id).orElseThrow(() -> new EntityNotFoundException("Job not found"));
        if (r.status() != null) {
            j.setStatus(r.status());
            if (r.status() == HmJob.Status.MARKED) j.setMarkedDate(LocalDate.now());
            if (r.status() == HmJob.Status.DISPATCHED) j.setDispatchedDate(LocalDate.now());
        }
        if (r.workflowData() != null) j.setWorkflowData(r.workflowData());
        j.setUpdatedBy(ctx.userId());
        return toJob(jobs.save(j));
    }

    @Transactional
    public void deleteJob(UUID id) {
        HmJob j = jobs.findById(id).orElseThrow(() -> new EntityNotFoundException("Job not found"));
        marks.deleteAll(marks.findByJobIdOrderByPieceNoAsc(id));
        jobs.delete(j);
    }

    // ---------- Marks ----------
    @Transactional
    public MarkResponse addMark(MarkRequest r) {
        HmJob j = jobs.findById(r.jobId()).orElseThrow(() -> new EntityNotFoundException("Job not found"));
        String huid = r.huidCode();
        if ((huid == null || huid.isBlank()) && j.isHuidRequired()) huid = generateHuid();

        HmMark m = HmMark.builder()
            .jobId(r.jobId()).pieceNo(r.pieceNo()).huidCode(huid)
            .markedPurity(r.markedPurity()).pieceWeight(r.pieceWeight())
            .markedByName(r.markedByName())
            .result(r.result() == null ? HmMark.Result.PASSED : r.result())
            .remarks(r.remarks()).build();
        stamp(m);
        HmMark saved = marks.save(m);

        // Auto-bump job status: SAMPLED → MARKED when all pieces marked successfully
        long passed = marks.countByJobIdAndResult(r.jobId(), HmMark.Result.PASSED);
        if (passed >= j.getPieceCount() && j.getStatus() != HmJob.Status.DISPATCHED) {
            j.setStatus(HmJob.Status.MARKED);
            j.setMarkedDate(LocalDate.now());
        } else if (j.getStatus() == HmJob.Status.RECEIVED) {
            j.setStatus(HmJob.Status.SAMPLED);
        }
        j.setUpdatedBy(ctx.userId()); jobs.save(j);
        return toMark(saved);
    }

    public List<MarkResponse> listMarks(UUID jobId) {
        return marks.findByJobIdOrderByPieceNoAsc(jobId).stream().map(this::toMark).toList();
    }

    // ---------- Dispatch ----------
    @Transactional
    public DispatchResponse dispatchJob(DispatchRequest r) {
        HmJob j = jobs.findById(r.jobId()).orElseThrow(() -> new EntityNotFoundException("Job not found"));
        if (j.getStatus() != HmJob.Status.MARKED
                && j.getStatus() != HmJob.Status.TESTED
                && j.getStatus() != HmJob.Status.DISPATCHED) {
            throw new IllegalStateException("Job must be MARKED, TESTED or DISPATCHED before dispatch (current: " + j.getStatus() + ")");
        }
        HmDispatch d = dispatches.findByJobId(r.jobId()).orElseGet(() -> {
            HmDispatch x = HmDispatch.builder()
                .dispatchNo("DSP-" + LocalDate.now().format(DF) + "-" + ThreadLocalRandom.current().nextInt(10000, 99999))
                .jobId(r.jobId()).dispatchedOn(LocalDate.now())
                .receivedByName(r.receivedByName()).pieceCount(r.pieceCount())
                .grossWeight(r.grossWeight()).remarks(r.remarks()).build();
            stamp(x); return x;
        });
        d.setReceivedByName(r.receivedByName()); d.setPieceCount(r.pieceCount());
        d.setGrossWeight(r.grossWeight()); d.setRemarks(r.remarks());
        d.setUpdatedBy(ctx.userId());
        HmDispatch saved = dispatches.save(d);
        j.setStatus(HmJob.Status.DISPATCHED); j.setDispatchedDate(LocalDate.now());
        j.setUpdatedBy(ctx.userId()); jobs.save(j);
        return toDispatch(saved);
    }

    public DispatchResponse getDispatch(UUID jobId) {
        return dispatches.findByJobId(jobId).map(this::toDispatch).orElse(null);
    }

    // ---------- helpers ----------
    private String generateHuid() {
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) sb.append(HUID_CHARS[RNG.nextInt(HUID_CHARS.length)]);
        return sb.toString();
    }
    private void stamp(com.nexus.common.domain.BaseEntity e) {
        UUID t = ctx.tenantId(); UUID u = ctx.userId();
        if (e.getTenantId() == null) e.setTenantId(t);
        if (e.getCreatedBy() == null) e.setCreatedBy(u);
        e.setUpdatedBy(u);
    }
    private JobResponse toJob(HmJob j) {
        return new JobResponse(j.getId(), j.getJobNumber(), j.getBranchId(), j.getJewellerId(), j.getLotId(),
            j.getKind(), j.getReceivedDate(), j.getMarkedDate(), j.getDispatchedDate(),
            j.getPurityLabel(), j.getDeclaredFineness(), j.getAssayedFineness(),
            j.getPieceCount(), j.getGrossWeight(), j.isHuidRequired(),
            j.getStatus(), j.getRatePerPiece(), j.getRemarks(), j.getWorkflowData());
    }
    private MarkResponse toMark(HmMark m) {
        return new MarkResponse(m.getId(), m.getJobId(), m.getPieceNo(), m.getHuidCode(), m.getMarkedPurity(),
            m.getPieceWeight(), m.getMarkedByName(), m.getResult(), m.getRemarks());
    }
    private DispatchResponse toDispatch(HmDispatch d) {
        return new DispatchResponse(d.getId(), d.getDispatchNo(), d.getJobId(), d.getDispatchedOn(),
            d.getReceivedByName(), d.getPieceCount(), d.getGrossWeight(), d.getRemarks());
    }

    // ---------- Delivery Orders ----------
    public List<DeliveryOrderResponse> listDeliveryOrders(HmDeliveryOrder.Status status) {
        UUID t = ctx.tenantId();
        var list = (status == null)
            ? deliveryOrders.findByTenantIdOrderByCreatedAtDesc(t)
            : deliveryOrders.findByTenantIdAndStatusOrderByCreatedAtDesc(t, status);
        return list.stream().map(this::toDeliveryOrder).toList();
    }

    @Transactional
    public DeliveryOrderResponse createDeliveryOrder(DeliveryOrderCreateRequest r) {
        String orderNo = "DO-" + LocalDate.now().format(DF) + "-" + ThreadLocalRandom.current().nextInt(10000, 99999);
        HmDeliveryOrder o = HmDeliveryOrder.builder()
            .orderNumber(orderNo)
            .customerId(r.customerId())
            .customerName(r.customerName())
            .deliveryType(r.deliveryType())
            .status(HmDeliveryOrder.Status.AWAITING_PICKUP)
            .remarks(r.remarks())
            .build();
        stamp(o);
        return toDeliveryOrder(deliveryOrders.save(o));
    }

    @Transactional
    public DeliveryOrderResponse markPickedUp(UUID id, DeliveryOrderPickupRequest r) {
        HmDeliveryOrder o = deliveryOrders.findById(id).orElseThrow(() -> new EntityNotFoundException("Delivery order not found"));
        if (o.getStatus() != HmDeliveryOrder.Status.AWAITING_PICKUP)
            throw new IllegalStateException("Order is not in AWAITING_PICKUP status");
        o.setCustomerGrossWeight(r.customerGrossWeight());
        o.setCustomerNetWeight(r.customerNetWeight());
        o.setStatus(HmDeliveryOrder.Status.IN_TRANSIT);
        o.setUpdatedBy(ctx.userId());
        return toDeliveryOrder(deliveryOrders.save(o));
    }

    @Transactional
    public DeliveryOrderResponse markReceived(UUID id, DeliveryOrderReceiveRequest r) {
        HmDeliveryOrder o = deliveryOrders.findById(id).orElseThrow(() -> new EntityNotFoundException("Delivery order not found"));
        if (o.getStatus() != HmDeliveryOrder.Status.IN_TRANSIT)
            throw new IllegalStateException("Order is not in IN_TRANSIT status");
        o.setPhcQuantity(r.phcQuantity());
        o.setPhcGrossWeight(r.phcGrossWeight());
        o.setDeclaredPurity(r.declaredPurity());
        o.setStatus(HmDeliveryOrder.Status.RECEIVED);
        o.setUpdatedBy(ctx.userId());
        return toDeliveryOrder(deliveryOrders.save(o));
    }

    @Transactional
    public DeliveryOrderResponse cancelDeliveryOrder(UUID id) {
        HmDeliveryOrder o = deliveryOrders.findById(id).orElseThrow(() -> new EntityNotFoundException("Delivery order not found"));
        if (o.getStatus() == HmDeliveryOrder.Status.RECEIVED)
            throw new IllegalStateException("Cannot cancel a RECEIVED order");
        o.setStatus(HmDeliveryOrder.Status.CANCELLED);
        o.setUpdatedBy(ctx.userId());
        return toDeliveryOrder(deliveryOrders.save(o));
    }

    // ---------- Delivery Returns ----------
    public List<DeliveryReturnResponse> listDeliveryReturns() {
        return deliveryReturns.findByTenantIdOrderByCreatedAtDesc(ctx.tenantId())
            .stream().map(this::toDeliveryReturn).toList();
    }

    @Transactional
    public DeliveryReturnResponse createDeliveryReturn(DeliveryReturnCreateRequest r) {
        String retNo = "RET-" + LocalDate.now().format(DF) + "-" + ThreadLocalRandom.current().nextInt(10000, 99999);
        HmDeliveryReturn ret = HmDeliveryReturn.builder()
            .returnNumber(retNo)
            .orderId(r.orderId())
            .orderNumber(r.orderNumber())
            .customerId(r.customerId())
            .customerName(r.customerName())
            .deliveryDetails(r.deliveryDetails())
            .remarks(r.remarks())
            .status(HmDeliveryReturn.Status.CREATED)
            .build();
        stamp(ret);
        return toDeliveryReturn(deliveryReturns.save(ret));
    }

    @Transactional
    public DeliveryReturnResponse markReturnDelivered(UUID id) {
        HmDeliveryReturn ret = deliveryReturns.findById(id).orElseThrow(() -> new EntityNotFoundException("Return not found"));
        if (ret.getStatus() == HmDeliveryReturn.Status.DELIVERED)
            throw new IllegalStateException("Return is already DELIVERED");
        ret.setStatus(HmDeliveryReturn.Status.DELIVERED);
        ret.setDeliveryDate(LocalDate.now());
        ret.setUpdatedBy(ctx.userId());
        return toDeliveryReturn(deliveryReturns.save(ret));
    }

    private DeliveryOrderResponse toDeliveryOrder(HmDeliveryOrder o) {
        return new DeliveryOrderResponse(
            o.getId(), o.getOrderNumber(), o.getCustomerId(), o.getCustomerName(),
            o.getDeliveryType(), o.getStatus(),
            o.getCustomerGrossWeight(), o.getCustomerNetWeight(),
            o.getPhcQuantity(), o.getPhcGrossWeight(), o.getDeclaredPurity(),
            o.getRemarks(), o.getCreatedAt() != null ? o.getCreatedAt() : Instant.now()
        );
    }

    private DeliveryReturnResponse toDeliveryReturn(HmDeliveryReturn r) {
        return new DeliveryReturnResponse(
            r.getId(), r.getReturnNumber(), r.getOrderId(), r.getOrderNumber(),
            r.getCustomerId(), r.getCustomerName(),
            r.getDeliveryDetails(), r.getRemarks(),
            r.getStatus(), r.getDeliveryDate(), r.getCreatedAt()
        );
    }
}
