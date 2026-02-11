// Generated from design tokens. Semantics reference primitives. Typography is DodadaFont.
import CoreGraphics

public struct DodadaInputSemanticTokens {
    public let height: CGFloat
    public let paddingHorizontal: CGFloat
    public let radius: CGFloat
    public let gap: CGFloat
    public let labelTypography: DodadaFont
    public let optionalTypography: DodadaFont
    public let placeholderTypography: DodadaFont
    public let contentTextTypography: DodadaFont
}

public enum DodadaInputSize { case `default`, sm, md, lg, xl }

public enum DodadaInputTokens {
    public static func semantic(size: DodadaInputSize = .default) -> DodadaInputSemanticTokens {
        let height: CGFloat
        let paddingH: CGFloat
        switch size {
        case .default: height = DodadaSizing.inputHeightDefault; paddingH = DodadaSpacing.md
        case .sm: height = DodadaSizing.inputHeightSm; paddingH = DodadaSpacing.sm
        case .md: height = DodadaSizing.inputHeightMd; paddingH = DodadaSpacing.md
        case .lg: height = DodadaSizing.inputHeightLg; paddingH = DodadaSpacing.lg
        case .xl: height = DodadaSizing.inputHeightXl; paddingH = DodadaSpacing.xl
        }
        return DodadaInputSemanticTokens(
            height: height,
            paddingHorizontal: paddingH,
            radius: DodadaRadius.md,
            gap: DodadaSpacing.sm,
            labelTypography: DodadaTypography.footnoteBold,
            optionalTypography: DodadaTypography.footnoteRegular,
            placeholderTypography: DodadaTypography.calloutRegular,
            contentTextTypography: DodadaTypography.caption2Regular
        )
    }
}
