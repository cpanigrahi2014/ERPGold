package com.nexus.admin.web;

import com.nexus.admin.application.service.UserAdminService;
import com.nexus.admin.application.service.UserAdminService.ApproveRequest;
import com.nexus.admin.application.service.UserAdminService.RejectRequest;
import com.nexus.admin.application.service.UserAdminService.UserView;
import com.nexus.admin.domain.model.Roles;
import com.nexus.admin.domain.model.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Admin-only management of {@link com.nexus.admin.domain.model.AppUser}
 * accounts: list pending/approved users, approve with role + branch
 * assignment, reject, disable, re-enable.
 *
 * <p>All endpoints require role {@code ADMIN} or {@code SUPER_ADMIN}.</p>
 */
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('" + Roles.ADMIN + "','" + Roles.SUPER_ADMIN + "')")
public class UserAdminController {

    private final UserAdminService service;

    @GetMapping
    public List<UserView> list(@RequestParam(value = "status", required = false) UserStatus status) {
        return service.list(status);
    }

    @PostMapping("/{id}/approve")
    public UserView approve(@PathVariable UUID id, @RequestBody ApproveRequest req) {
        return service.approve(id, req);
    }

    @PostMapping("/{id}/reject")
    public UserView reject(@PathVariable UUID id, @RequestBody(required = false) RejectRequest req) {
        return service.reject(id, req);
    }

    @PostMapping("/{id}/disable")
    public UserView disable(@PathVariable UUID id, @RequestBody(required = false) RejectRequest req) {
        return service.disable(id, req);
    }

    @PostMapping("/{id}/enable")
    public UserView enable(@PathVariable UUID id) {
        return service.reEnable(id);
    }

    /** All roles known to the system. Used by admin UI to populate the assignment picker. */
    @GetMapping("/roles")
    public List<String> allRoles() {
        return Roles.ALL.stream().sorted().toList();
    }
}
