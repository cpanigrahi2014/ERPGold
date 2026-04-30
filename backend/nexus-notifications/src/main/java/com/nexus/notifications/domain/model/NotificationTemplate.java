package com.nexus.notifications.domain.model;

import com.nexus.common.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "notification_templates", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "code"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NotificationTemplate extends BaseEntity {

    @Column(name = "code", nullable = false, length = 60) private String code;
    @Column(name = "name", nullable = false, length = 200) private String name;

    @Enumerated(EnumType.STRING) @Column(name = "channel", nullable = false, length = 20)
    private Channel channel;

    @Column(name = "subject_tpl", length = 300) private String subjectTpl;
    @Column(name = "body_tpl", columnDefinition = "TEXT", nullable = false) private String bodyTpl;
    @Column(name = "active") @Builder.Default private Boolean active = true;
    @Column(name = "description", length = 500) private String description;

    public enum Channel { EMAIL, SMS, WEBHOOK, IN_APP }
}
