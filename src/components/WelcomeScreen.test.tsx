import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WelcomeScreen } from './WelcomeScreen'

const defaultProps = {
  mode: 'welcome' as const,
  defaultVaultPath: '~/Documents/Laputa',
  onCreateVault: vi.fn(),
  onCreateNewVault: vi.fn(),
  onOpenFolder: vi.fn(),
  creating: false,
  error: null,
}

describe('WelcomeScreen', () => {
  describe('welcome mode', () => {
    it('renders welcome title and subtitle', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.getByText('Welcome to Laputa')).toBeInTheDocument()
      expect(screen.getByText(/Wiki-linked knowledge management/)).toBeInTheDocument()
    })

    it('shows all three option buttons', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.getByTestId('welcome-create-new')).toHaveTextContent('Create a new vault')
      expect(screen.getByTestId('welcome-open-folder')).toHaveTextContent('Open existing vault')
      expect(screen.getByTestId('welcome-create-vault')).toHaveTextContent('Get started with a template')
    })

    it('shows default vault path in template option description', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.getByText(/~\/Documents\/Laputa/)).toBeInTheDocument()
    })

    it('calls onCreateNewVault when create new button is clicked', () => {
      const onCreateNewVault = vi.fn()
      render(<WelcomeScreen {...defaultProps} onCreateNewVault={onCreateNewVault} />)
      fireEvent.click(screen.getByTestId('welcome-create-new'))
      expect(onCreateNewVault).toHaveBeenCalledOnce()
    })

    it('calls onCreateVault when template button is clicked', () => {
      const onCreateVault = vi.fn()
      render(<WelcomeScreen {...defaultProps} onCreateVault={onCreateVault} />)
      fireEvent.click(screen.getByTestId('welcome-create-vault'))
      expect(onCreateVault).toHaveBeenCalledOnce()
    })

    it('calls onOpenFolder when open folder button is clicked', () => {
      const onOpenFolder = vi.fn()
      render(<WelcomeScreen {...defaultProps} onOpenFolder={onOpenFolder} />)
      fireEvent.click(screen.getByTestId('welcome-open-folder'))
      expect(onOpenFolder).toHaveBeenCalledOnce()
    })

    it('disables all buttons while creating', () => {
      render(<WelcomeScreen {...defaultProps} creating={true} />)
      expect(screen.getByTestId('welcome-create-new')).toBeDisabled()
      expect(screen.getByTestId('welcome-open-folder')).toBeDisabled()
      expect(screen.getByTestId('welcome-create-vault')).toBeDisabled()
    })

    it('shows loading text on template button while creating', () => {
      render(<WelcomeScreen {...defaultProps} creating={true} />)
      expect(screen.getByTestId('welcome-create-vault')).toHaveTextContent(/Creating vault/)
    })

    it('shows error message when error is set', () => {
      render(<WelcomeScreen {...defaultProps} error="Permission denied" />)
      expect(screen.getByTestId('welcome-error')).toHaveTextContent('Permission denied')
    })

    it('does not show error when error is null', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.queryByTestId('welcome-error')).not.toBeInTheDocument()
    })

    it('does not show path badge in welcome mode', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.queryByText('~/Laputa')).not.toBeInTheDocument()
    })
  })

  describe('vault-missing mode', () => {
    const missingProps = {
      ...defaultProps,
      mode: 'vault-missing' as const,
      missingPath: '~/Laputa',
    }

    it('renders vault not found title', () => {
      render(<WelcomeScreen {...missingProps} />)
      expect(screen.getByText('Vault not found')).toBeInTheDocument()
      expect(screen.getByText(/could not be found on disk/)).toBeInTheDocument()
    })

    it('shows the missing vault path in a badge', () => {
      render(<WelcomeScreen {...missingProps} />)
      expect(screen.getByText('~/Laputa')).toBeInTheDocument()
    })

    it('shows "Choose a different folder" instead of "Open existing vault"', () => {
      render(<WelcomeScreen {...missingProps} />)
      expect(screen.getByTestId('welcome-open-folder')).toHaveTextContent('Choose a different folder')
    })
  })

  describe('data-testid', () => {
    it('has welcome-screen container testid', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.getByTestId('welcome-screen')).toBeInTheDocument()
    })
  })
})
