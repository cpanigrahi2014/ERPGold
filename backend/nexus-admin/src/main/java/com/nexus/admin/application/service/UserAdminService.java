package com.nexus.admin.application.service;

import com.nexus.admin.application.support.CurrentContext;
import com.nexus.admin.domain.model.AppUser;
import com.nexus.admin.domain.model.Branch;
import com.nexus.admin.domain.model.Roles;
import com.nexus.admin.domain.model.UserStatus;
import com.nexus.admin.domain.repository.AppUserRepository;
import com.nexus.admin.domain.repository.BranchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Admin-only operations against {@link AppUser}: list pending registrations,
 * approve (with role + branch assignment), reject, disable, re-enable.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class UserAdminService {

    private final AppUserRepository userRepo;
    private final BranchRepository branchRepo;
    private final CurrentContext ctx;

    public record UserView(
        String id, String email, String fullName, String status,
        String requestedRole, Set<String> roles,
        String branchId, String branchName,
        String approvedBy, Instant approvedAt,
        String rejectReason, boolean active,
        Instant createdAt
    ) {
        public static UserView from(AppUser u) {
            return new UserView(
                u.getId().toString(), u.getEmail(), u.getFullName(),
                u.getStatus().name(), u.getRequestedRole(),
                u.getRoles() == null ? Set.of() : new TreeSet<>(u.getRoles()),
                u.getBranch() == null ? null : u.getBranch().getId().toString(),
                u.getBranch() == null ? null : u.getBranch().getName(),
                u.getApprovedBy() == null ? null : u.getApprovedBy().toString(),
                u.getApprovedAt(),
                u.getRejectReason(), u.isActive(),
                u.getCreatedAt()
            );
        }
    }

    public record ApproveRequest(Set<String> roles, UUID branchId) {}
    public record RejectRequest(String reason) {}

    @Transactional(readOnly = true)
    public List<UserView> list(UserStatus status) {
        UUID tenant = ctx.tenantId();
        List<AppUser> users = (status == null)
            ? userRepo.findByTenantId(tenant)
            : userRepo.findByTenantIdAndStatus(tenant, status);
        return users.stream()
            .sorted(Comparator.comparing(AppUser::getCreatedAt).reversed())
            .map(UserView::from).toList();
    }

    public UserView approve(UUID userId, ApproveRequest req) {
        AppUser u = userRepo.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        if (req == null || req.roles() == null || req.roles().isEmpty()) {
            throw new IllegalArgumentException("At least one role must be assigned on approval.");
        }
        for (String r : req.roles()) {
            if (!Roles.ALL.contains(r)) {
                throw new IllegalArgumentException("Unknown role: " + r);
            }
        }
        u.setRoles(new HashSet<>(req.roles()));
        if (req.branchId() != null) {
            Branch b = branchRepo.findById(req.branchId())
                .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + req.branchId()));
            u.setBranch(b);
        }
        u.setStatus(UserStatus.APPROVED);
        u.setActive(true);
        u.setApprovedBy(ctx.userId());
        u.setApprovedAt(Instant.now());
        u.setRejectReason(null);
        u.setUpdatedBy(ctx.userId());
        return UserView.from(u);
    }

    public UserView reject(UUID userId, RejectRequest req) {
        AppUser u = userRepo.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        u.setStatus(UserStatus.REJECTED);
        u.setActive(false);
        u.setApprovedBy(ctx.userId());
        u.setApprovedAt(Instant.now());
        u.setRejectReason(req == null ? null : req.reason());
        u.setUpdatedBy(ctx.userId());
        return UserView.from(u);
    }

    public UserView disable(UUID userId, RejectRequest req) {
        AppUser u = userRepo.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        u.setStatus(UserStatus.DISABLED);
        u.setActive(false);
        u.setRejectReason(req == null ? null : req.reason());
        u.setUpdatedBy(ctx.userId());
        return UserView.from(u);
    }

    public UserView reEnable(UUID userId) {
        AppUser u = userRepo.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        if (u.getRoles() == null || u.getRoles().isEmpty()) {
            throw new IllegalArgumentException("Cannot re-enable a user with no roles. Approve with roles instead.");
        }
        u.setStatus(UserStatus.APPROVED);
        u.setActive(true);
        u.setRejectReason(null);
        u.setUpdatedBy(ctx.userId());
        return UserView.from(u);
    }
}
