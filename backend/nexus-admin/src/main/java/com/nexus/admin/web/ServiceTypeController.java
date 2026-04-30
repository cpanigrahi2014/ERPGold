package com.nexus.admin.web;

import com.nexus.admin.domain.model.ServiceType;
import com.nexus.admin.domain.repository.ServiceTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/service-types")
@RequiredArgsConstructor
public class ServiceTypeController {

    private final ServiceTypeRepository repo;

    public record ServiceTypeView(UUID id, String code, String name,
                                   ServiceType.Category category, String hsnCode, boolean active) {
        static ServiceTypeView from(ServiceType s) {
            return new ServiceTypeView(s.getId(), s.getCode(), s.getName(),
                s.getCategory(), s.getHsnCode(), s.isActive());
        }
    }

    @GetMapping
    public List<ServiceTypeView> list() {
        return repo.findAll().stream().map(ServiceTypeView::from).toList();
    }
}
