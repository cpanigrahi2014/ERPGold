package com.nexus.admin.web;

import com.nexus.admin.application.service.AuthService;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}
    public record LoginResponse(String accessToken, String email, String fullName) {}

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest r) {
        return authService.login(r.email(), r.password());
    }
}
