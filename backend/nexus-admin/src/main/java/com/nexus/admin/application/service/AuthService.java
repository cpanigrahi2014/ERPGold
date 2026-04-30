package com.nexus.admin.application.service;

import com.nexus.admin.domain.model.AppUser;
import com.nexus.admin.domain.repository.AppUserRepository;
import com.nexus.admin.web.AuthController.LoginResponse;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AppUserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    @Value("${nexus.jwt.secret}") private String secret;
    @Value("${nexus.jwt.access-token-expiration:3600000}") private long expMs;

    public LoginResponse login(String email, String rawPassword) {
        AppUser user = userRepo.findByEmail(email)
            .filter(AppUser::isActive)
            .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }
        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        String token = Jwts.builder()
            .subject(user.getId().toString())
            .claim("tenant_id", user.getTenantId().toString())
            .claim("email", user.getEmail())
            .claim("roles", user.getRoles())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusMillis(expMs)))
            .signWith(key)
            .compact();
        return new LoginResponse(token, user.getEmail(), user.getFullName());
    }
}
