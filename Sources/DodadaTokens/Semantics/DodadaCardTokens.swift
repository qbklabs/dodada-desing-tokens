// Generated from design tokens. Semantics reference primitives.
import CoreGraphics

public struct DodadaCardSemanticTokens {
    public let padding: CGFloat
    public let radius: CGFloat
    public let gap: CGFloat
}

public enum DodadaCardSize { case sm, md, lg }

public enum DodadaCardTokens {
    public static func semantic(size: DodadaCardSize = .md) -> DodadaCardSemanticTokens {
        let padding: CGFloat
        let radius: CGFloat
        let gap: CGFloat
        switch size {
        case .sm: padding = DodadaSpacing.md; radius = DodadaRadius.sm; gap = DodadaSpacing.sm
        case .md: padding = DodadaSpacing.lg; radius = DodadaRadius.md; gap = DodadaSpacing.md
        case .lg: padding = DodadaSpacing.xl; radius = DodadaRadius.lg; gap = DodadaSpacing.lg
        }
        return DodadaCardSemanticTokens(padding: padding, radius: radius, gap: gap)
    }
}
