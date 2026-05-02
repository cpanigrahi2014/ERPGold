package com.nexus.admin.web;

import com.nexus.admin.application.service.AuthService;
import com.nexus.admin.domain.model.Roles;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/admin/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}
    public record LoginResponse(String accessToken, String email, String fullName, Set<String> roles) {}

    public record RegisterRequest(
        @NotBlank @Email String email,
        @NotBlank String fullName,
        @NotBlank @Size(min = 8, message = "Password must be at least 8 characters") String password,
        String requestedRole
    ) {}
    public record RegisterResponse(String userId, String email, String status, String message) {}

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest r) {
        return authService.login(r.email(), r.password());
    }

    @PostMapping("/register")
    public RegisterResponse register(@Valid @RequestBody RegisterRequest r) {
        return authService.register(r.email(), r.fullName(), r.password(), r.requestedRole());
    }

    /** Public list of roles a user may request at registration. */
    @GetMapping("/roles")
    public List<String> requestableRoles() {
        return Roles.SELF_SERVICE_REQUESTABLE.stream().sorted().toList();
    }
}
